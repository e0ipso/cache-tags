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
});
