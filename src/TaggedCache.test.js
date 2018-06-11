const TaggedCache = require('./TaggedCache');

describe('TaggedCache', () => {
  let store;
  let sut;

  beforeEach(() => {
    store = {};
    sut = new TaggedCache(store, ['lo', 'rem']);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('It can increment', () => {
    store.incrby = jest.fn().mockReturnValue(Promise.resolve());
    sut.increment('k');
    expect(store.incrby).toHaveBeenCalledWith('k', 1);
  });

  test('It can decrement', () => {
    store.decrby = jest.fn().mockReturnValue(Promise.resolve());
    sut.decrement('k');
    expect(store.decrby).toHaveBeenCalledWith('k', 1);
  });

  test('It can setex', () => {
    jest.spyOn(sut, 'set').mockReturnValue();
    sut.setex('k', 1, 'v');
    expect(sut.set).toHaveBeenCalledWith('k', 'v', 'EX', 1);
  });

  test('It can psetex', () => {
    jest.spyOn(sut, 'set').mockReturnValue();
    sut.psetex('k', 1, 'v');
    expect(sut.set).toHaveBeenCalledWith('k', 'v', 'PX', 1);
  });

  test('It can setMultiple', () => {
    expect.assertions(3);
    store.set = jest.fn().mockReturnValue(Promise.resolve());
    return sut
      .setMultiple({ k: 'v', k2: 'v2' }, 1)
      .then(() => {
        expect(store.set).toHaveBeenCalledWith('k', 'v', 'PX', 1000);
        expect(store.set).toHaveBeenCalledWith('k2', 'v2', 'PX', 1000);
        return sut.setMultiple({ k3: 'v3' });
      })
      .then(() => {
        expect(store.set).toHaveBeenCalledWith('k3', 'v3');
      });
  });

  test('It can delete', () => {
    store.del = jest.fn().mockReturnValue(Promise.resolve());
    sut.delete('k');
    expect(store.del).toHaveBeenCalledWith('k');
  });

  test('It can deleteMultiple', () => {
    store.del = jest.fn().mockReturnValue(Promise.resolve());
    sut.deleteMultiple(['k', 'k2']).then(() => {
      expect(store.del).toHaveBeenCalledWith('k');
      expect(store.del).toHaveBeenCalledWith('k2');
    });
  });

  test('It can clear', () => {
    store.flushdb = jest.fn().mockReturnValue(Promise.resolve());
    sut.clear();
    expect(store.flushdb).toHaveBeenCalled();
  });

  test('It can add', () => {
    expect.assertions(2);
    store.set = jest.fn().mockReturnValue(Promise.resolve());
    return sut
      .add('k', 'v', 1)
      .then(() => {
        expect(store.set).toHaveBeenLastCalledWith('k', 'v', 'NX', 'PX', 1000);
        return sut.add('k2', 'v2');
      })
      .then(() => {
        expect(store.set).toHaveBeenLastCalledWith('k2', 'v2', 'NX');
      });
  });
});
