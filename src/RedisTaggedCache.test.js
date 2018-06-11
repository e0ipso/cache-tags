const RedisTaggedCache = require('./RedisTaggedCache');

describe('RedisTaggedCache', () => {
  let sut;
  let store;
  let tags;
  let val;
  let redisSet;

  beforeEach(() => {
    val = 0;
    redisSet = new Set();
    store = {
      incrby: jest.fn().mockImplementation((key, by) => {
        val += by;
        return Promise.resolve(Math.random());
      }),
      decrby: jest.fn().mockImplementation((key, by) => {
        val -= by;
        return Promise.resolve(Math.random());
      }),
      get: jest.fn().mockImplementation(() => Promise.resolve(val)),
      set: jest.fn().mockImplementation((k, v) => {
        val = v;
        return Promise.resolve(Math.random());
      }),
      sadd: jest.fn().mockImplementation(v => {
        redisSet.add(v);
        return Promise.resolve(Math.random());
      }),
      options: { keyPrefix: 'the-prefix!::' },
    };
    tags = {
      getNamespace: jest.fn().mockReturnValue(Promise.resolve('a-namespace')),
    };
    sut = new RedisTaggedCache(store, tags);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  test('It can increment correctly', () => {
    expect.assertions(2);
    return sut
      .increment('cache-key', 2)
      .then(res => {
        expect(res).toBeUndefined();
        return sut.increment('cache-key').then(() => sut.get('cache-key'));
      })
      .then(res => {
        expect(res).toBe(3);
      });
  });

  test('It can decrement correctly', () => {
    expect.assertions(2);
    val = 7;
    return sut
      .decrement('cache-key', 2)
      .then(res => {
        expect(res).toBeUndefined();
        return sut.decrement('cache-key').then(() => sut.get('cache-key'));
      })
      .then(res => {
        expect(res).toBe(4);
      });
  });

  test('It can handle deleteValues with empty members', () => {
    expect.assertions(3);
    const referenceKeys = ['lo', 'rem'];
    sut.getAllMembers = jest.fn().mockReturnValue(Promise.resolve([]));
    return sut.deleteValues(referenceKeys).then(res => {
      expect(sut.getAllMembers).toHaveBeenCalledWith('lo');
      expect(sut.getAllMembers).toHaveBeenCalledWith('rem');
      expect(res).toBeUndefined();
    });
  });

  test('It can handle fetchTaggedKeys without keys', () => {
    expect.assertions(1);
    return sut.fetchTaggedKeys([]).then(res => {
      expect(res).toHaveLength(0);
    });
  });
});
