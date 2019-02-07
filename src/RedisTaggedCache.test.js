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

  test('It can get a single page of tag members', async () => {
    expect.assertions(2);
    const cursor = 100;
    const members = ['test-tag'];
    sut.debounce = jest.fn().mockResolvedValue([cursor, members]);

    const resolved = await sut.getMemberPage('testKey');
    expect(sut.debounce).toHaveBeenCalledWith('sscan', 'testKey', 0);
    expect(resolved).toEqual({
      cursor,
      members,
    });
  });

  test('It can batch delete tag members', async () => {
    expect.assertions(5);
    const tagId = 'tag-id';
    const cursor = 100;
    const members = ['the-prefix!::test-tag', 'the-prefix!::test-tag-2'];
    sut.getMemberPage = jest.fn().mockResolvedValue({ cursor, members });
    sut.deleteMultiple = jest.fn();
    sut.store.srem = jest.fn();

    const resolved = await sut.batchDeleteTagMembers(tagId, 0);

    expect(sut.store.srem).toHaveBeenCalledTimes(2);
    expect(sut.store.srem).toHaveBeenLastCalledWith(tagId, 'test-tag-2');
    expect(sut.deleteMultiple).toHaveBeenCalledWith(['test-tag', 'test-tag-2']);
    expect(resolved).not.toBeNull();

    sut.getMemberPage = jest.fn().mockResolvedValue({ cursor: 0, members });
    const newResolved = await resolved();
    expect(newResolved).toBeNull();
  });

  test('Its trampoline utility method behaves as expected', async () => {
    expect.assertions(1);
    const count = 3;
    const cb = jest.fn((iterations = 1) => {
      if (iterations === count) {
        return null;
      }

      return cb.bind(null, iterations + 1);
    });

    await sut.trampoline(cb);
    expect(cb).toHaveBeenCalledTimes(count);
  });

  test('It can batch delete members for all tags', async () => {
    const members = ['tag-id-1', 'tag-id-2'];
    sut.tags.tagIds = jest.fn().mockResolvedValue(['tag-set-1', 'tag-set-2']);
    sut.getMemberPage = jest.fn().mockResolvedValue({ cursor: 0, members });
    sut.deleteMultiple = jest.fn();
    sut.store.srem = jest.fn();

    await sut.batchDeleteWithTags();

    expect(sut.store.srem).toHaveBeenCalledTimes(4);
    expect(sut.deleteMultiple).toHaveBeenCalledWith(['tag-id-1', 'tag-id-2']);
  });
});
