const { TaggableCache: Redis } = require('../lib');

const generateTest = (redis, numItems) => () => {
  const setData = () => Promise.all(Array(numItems).fill(0).map((v, i) => i)
    .map(
      id => redis
        .tags([`tag_${id % 2}`, `post_${id}`])
        .set(`post_${id}`, `Post ${id}!`)
    ));
  const getData = () => Promise.all(Array(numItems).fill(0).map((v, i) => i)
    .map(
      id => redis
        .tags([`tag_${id % 2}`, `post_${id}`])
        .get(`post_${id}`)
    ));
  expect.assertions(9);
  return (new Promise((resolve, reject) => {
    redis.on('ready', resolve);
    redis.on('error', reject);
  }))
    .then(setData)
    .then(getData)
    .then(res => {
      expect(res).toHaveLength(numItems);
      const expected = Array(numItems).fill(0).map((v, i) => i)
        .map(i => `Post ${i}!`).join('|');
      expect(res.join('|')).toBe(expected);
    })
    .then(() => Promise.all([
      redis.tags(['tag_0']).get('post_0'),
      redis.get('post_0'),
    ]))
    .then(res => {
      expect(res).toEqual(['Post 0!', 'Post 0!']);
    })
    .then(() => redis.tags(['tag_0']).list())
    .then(res => {
      expect(res).toHaveLength(numItems / 2);
    })
    .then(() => redis.tags(['tag_1']).list())
    .then(res => {
      expect(res).toHaveLength(numItems / 2);
    })
    .then(() => redis.tags(['tag_0']).flush())
    .then(() => redis.tags(['tag_0']).get('post_0'))
    .then(res => {
      expect(res).toBeNull();
    })
    .then(() => redis.tags(['tag_0']).list())
    .then(res => {
      expect(res).toHaveLength(0);
    })
    .then(() => Promise.all([
      redis.tags(['tag_1']).get('post_1'),
      redis.get('post_1'),
    ]))
    .then(res => {
      expect(res).toEqual(['Post 1!', 'Post 1!']);
    })
    .then(() => redis.tags(['tag_1']).list())
    .then(res => {
      expect(res).toHaveLength(numItems / 2);
    });
};

describe('Cache Tags', () => {
  describe('in a node', () => {
    let redis;
    const numItems = 200;

    beforeAll(() => {
      redis = new Redis('127.0.0.1:6379');
    });
    afterAll(() => {
      redis.disconnect();
    });
    test('it works', () => generateTest(redis, numItems)());
  });
  describe('in a cluster', () => {
    let redis;
    const numItems = 200;

    beforeAll(() => {
      redis = new Redis.Cluster([
        '127.0.0.1:30000',
        '127.0.0.1:30001',
        '127.0.0.1:30002',
        '127.0.0.1:30003',
        '127.0.0.1:30004',
        '127.0.0.1:30005',
        '127.0.0.1:30006',
      ]);
    });
    afterAll(() => {
      redis.disconnect();
    });
    test('it works', () => generateTest(redis, numItems)());
  });
});
