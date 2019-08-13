const TagSet = require('./TagSet');

describe('TagSet', () => {
  let store;
  let sut;

  beforeEach(() => {
    store = {};
    sut = new TagSet(store, ['lo', 'rem']);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('It can cache the namespace', () => {
    expect.assertions(3);
    jest.spyOn(sut, 'tagIds').mockReturnValue(Promise.resolve(['a', 'b']));
    return sut
      .getNamespace()
      .then(ns => {
        expect(ns).toBe('a|b');
        return sut.getNamespace();
      })
      .then(ns => {
        expect(ns).toBe('a|b');
        expect(sut.tagIds).toHaveBeenCalledTimes(1);
      });
  });

  test('It initializes empty tags', () => {
    expect.assertions(3);
    jest
      .spyOn(sut.debouncer, 'debounce')
      .mockImplementation(
        (cmd, k) =>
          k === 'tag:lo:key' ? Promise.resolve('abc') : Promise.resolve()
      );
    jest.spyOn(sut, 'initTag').mockReturnValue(Math.random());
    return sut.tagIds().then(() => {
      expect(sut.debouncer.debounce).toHaveBeenCalledWith('get', 'tag:lo:key');
      expect(sut.debouncer.debounce).toHaveBeenCalledWith('get', 'tag:rem:key');
      expect(sut.initTag).toHaveBeenCalledWith(
        'tag:rem:key',
        undefined,
        undefined
      );
    });
  });

  test('It can initialize new tags', () => {
    expect.assertions(1);
    store.setnx = jest.fn().mockReturnValue(Promise.resolve(1));
    return sut.initTag('whatever').then(id => {
      expect(id).not.toBeUndefined();
    });
  });

  test('It can initialize existing tags', () => {
    expect.assertions(2);
    store.setnx = jest.fn().mockReturnValue(Promise.resolve(0));
    jest.spyOn(sut.debouncer, 'debounce').mockReturnValue(Math.random());
    return sut.initTag('whatever').then(id => {
      expect(id).not.toBeUndefined();
      expect(sut.debouncer.debounce).toHaveBeenCalledWith('get', 'whatever');
    });
  });
});
