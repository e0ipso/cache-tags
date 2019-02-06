const Debouncer = require('./Debouncer');

describe('Debouncer', () => {
  test('debounce can handle errors', () => {
    expect.assertions(1);
    const backend = {
      foo: jest.fn().mockReturnValue(Promise.reject(new Error('Boooh!'))),
    };
    const sut = new Debouncer(backend);
    return sut.debounce('foo', []).catch(e => {
      expect(e.message).toBe('Boooh!');
    });
  });

  test('debounce behaves as expected', async () => {
    expect.assertions(4);
    const key = 'foo::[]';
    const expected = Promise.resolve('Completed');

    const backend = {
      foo: jest.fn().mockReturnValue(expected),
    };

    const sut = new Debouncer(backend);
    sut.inflight.get = jest.fn();
    sut.inflight.set = jest.fn();
    sut.inflight.delete = jest.fn();

    expect(await sut.debounce('foo', [])).toBe('Completed');
    expect(sut.inflight.get).toHaveBeenCalledWith(key);
    expect(sut.inflight.set).toHaveBeenCalledWith(key, expected);
    expect(sut.inflight.delete).toHaveBeenCalledWith(key);
  });
});
