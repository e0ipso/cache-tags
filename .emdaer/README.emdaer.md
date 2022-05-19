# Cache Tags <img src="./logo.svg" alt="Cache Tags logo" title="Cache Tags logo" width="100" align="right">

<p align="center">
<!--emdaer-p
  - '@emdaer/plugin-value-from-package'
  - value: description
-->
</p>
<hr />

<!--emdaer-t
  - '@emdaer/transform-table-of-contents'
--> · <!--emdaer-p

- '@emdaer/plugin-shields'
- shields:
  - alt: 'GitHub Actions' image:
    'github/workflows/status/e0ipso/cache-tags/Test' link:
    'https://github.com/e0ipso/cache-tags/' style: 'flat-square'
  - alt: 'Documented with emdaer' image:
    'badge/📓-documented%20with%20emdaer-F06632.svg' link:
    'https://github.com/emdaer/emdaer' style: 'flat-square' -->

## Install

1. `yarn add cache-tags`
2. [Install Redis](https://redis.io/download) normally. If you want to spin up a
   local cluster for testing you can use: `yarn create-cluster` and
   `yarn destroy-cluster`.

## Why?

If you need to invalidate cache entries that are related to each other, or just
list these cache entries that relate to each other you can use tags. You will
need to add the tags to the cache entries to be able to retrieve them later.

This module only supports Redis as the cache back-end at the moment. It is
tested against a single node and a cluster of 3 masters and 3 replicas.

Concept inspired by [Drupal](https://www.drupal.org/) 8's
[cache tags](https://www.drupal.org/docs/8/api/cache-api/cache-tags). API and
implementation inspired by
[Laravel's Cache Tags](https://laravel.com/docs/5.6/cache#cache-tags).

## Usage

If you want to see more usage examples, check the
[functional tests](./__tests__/functional.js).

This project uses [ioredis](https://www.npmjs.com/package/ioredis) as the Redis
client. All the options for that project are available here.

```js
const { TaggableCache: Redis } = require("cache-tags");

// Initialize the Redis client as you would using ioredis.
const redis = new Redis("127.0.0.1:6379");
// Now you can use `redis` as you would with ioredis, or you can enter tagged
// mode.
Promise.resolve()
  // Use .tags to enter tagged mode, then call set or get.
  .then(() =>
    Promise.all([
      redis.tags(["first-tag"]).set("cache-entry-1", "Lorem", 1234),
      redis.tags(["first-tag", "boring"]).set("cache-entry-2", "Ipsum", 2324),
    ])
  )
  .then(() =>
    Promise.all([
      // You can scope gets by enterign tagged mode.
      redis.tags(["first-tag"]).get("cache-entry-1"),
      // Or you can get the item as you would do normally.
      redis.get("cache-entry-2"),
    ])
  )
  .then(console.log) // ['Lorem', 'Ipsum'].
  // You can also use tags to list items.
  .then(() => redis.tags(["first-tag"]).list())
  .then(console.log) // ['Lorem', 'Ipsum'].
  .then(() => redis.tags(["boring"]).list())
  .then(console.log) // ['Ipsum'].
  // You can also use tags to invalidate items.
  .then(() => redis.tags(["first-tag"]).list())
  .then(() =>
    Promise.all([
      redis.tags(["first-tag"]).get("cache-entry-1"),
      redis.get("cache-entry-2"),
    ])
  )
  .then(console.log); // []. Cache entries with tag 'first-tag' are gone.
```

## Contributors

<!--emdaer-p
  - '@emdaer/plugin-contributors-details-github'
-->

## License

<!--emdaer-p
  - '@emdaer/plugin-license-reference'
-->

<!--emdaer-t
  - '@emdaer/transform-prettier'
  - options:
      proseWrap: preserve
      singleQuote: true
      trailingComma: es5
-->
