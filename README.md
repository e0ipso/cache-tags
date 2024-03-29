<!--
  This file was generated by emdaer

  Its template can be found at .emdaer/README.emdaer.md
-->

<!--
  emdaerHash:261cd76b37249fc3c9f4bc01300c09c6
-->

<h1 id="cache-tags-img-src-logo-svg-alt-cache-tags-logo-title-cache-tags-logo-width-100-align-right-">Cache Tags <img src="./logo.svg" alt="Cache Tags logo" title="Cache Tags logo" width="100" align="right"></h1>
<p></p><p align="center">
Adds cache tags for bulk invalidation.
</p><p></p>
<hr>

<!-- toc -->
<ul>
<li><a href="#install">Install</a></li>
<li><a href="#why">Why?</a></li>
<li><a href="#usage">Usage</a></li>
<li><a href="#contributors">Contributors</a></li>
<li><a href="#license">License</a></li>
</ul>
<!-- tocstop -->
<p>· <a href="https://github.com/e0ipso/cache-tags/"><img src="https://img.shields.io/github/workflows/status/e0ipso/cache-tags/test.yml/master?style=flat-square" alt="GitHub Actions"></a> <a href="https://github.com/emdaer/emdaer"><img src="https://img.shields.io/badge/📓-documented%20with%20emdaer-F06632.svg?style=flat-square" alt="Documented with emdaer"></a></p>
<h2 id="install">Install</h2>
<ol>
<li><code>yarn add cache-tags</code></li>
<li><a href="https://redis.io/download">Install Redis</a> normally. If you want to spin up
a local cluster for testing you can use: <code>yarn create-cluster</code> and
<code>yarn destroy-cluster</code>.</li>
</ol>
<h2 id="why-">Why?</h2>
<p>If you need to invalidate cache entries that are related to each other, or just
list these cache entries that relate to each other you can use tags. You will
need to add the tags to the cache entries to be able to retrieve them later.</p>
<p>This module only supports Redis as the cache back-end at the moment. It is
tested against a single node and a cluster of 3 masters and 3 replicas.</p>
<p>Concept inspired by <a href="https://www.drupal.org/">Drupal</a> 8’s
<a href="https://www.drupal.org/docs/8/api/cache-api/cache-tags">cache tags</a>. API and
implementation inspired by
<a href="https://laravel.com/docs/5.6/cache#cache-tags">Laravel’s Cache Tags</a>.</p>
<h2 id="usage">Usage</h2>
<p>If you want to see more usage examples, check the
<a href="./__tests__/functional.js">functional tests</a>.</p>
<p>This project uses <a href="https://www.npmjs.com/package/ioredis">ioredis</a> as the Redis
client. All the options for that project are available here.</p>

```js
const { TaggableCache: Redis } = require('cache-tags');

// Initialize the Redis client as you would using ioredis.
const redis = new Redis('127.0.0.1:6379');
// Now you can use `redis` as you would with ioredis, or you can enter tagged
// mode.
Promise.resolve()
  // Use .tags to enter tagged mode, then call set or get.
  .then(() =>
    Promise.all([
      redis.tags(['first-tag']).set('cache-entry-1', 'Lorem', 1234),
      redis.tags(['first-tag', 'boring']).set('cache-entry-2', 'Ipsum', 2324),
    ])
  )
  .then(() =>
    Promise.all([
      // You can scope gets by enterign tagged mode.
      redis.tags(['first-tag']).get('cache-entry-1'),
      // Or you can get the item as you would do normally.
      redis.get('cache-entry-2'),
    ])
  )
  .then(console.log) // ['Lorem', 'Ipsum'].
  // You can also use tags to list items.
  .then(() => redis.tags(['first-tag']).list())
  .then(console.log) // ['Lorem', 'Ipsum'].
  .then(() => redis.tags(['boring']).list())
  .then(console.log) // ['Ipsum'].
  // You can also use tags to invalidate items.
  .then(() => redis.tags(['first-tag']).list())
  .then(() =>
    Promise.all([
      redis.tags(['first-tag']).get('cache-entry-1'),
      redis.get('cache-entry-2'),
    ])
  )
  .then(console.log); // []. Cache entries with tag 'first-tag' are gone.
```
<h2 id="contributors">Contributors</h2>
<details>
<summary><strong>Contributors</strong></summary><br>
<a title="Engineer and programmer focused on online applications." href="https://github.com/e0ipso">
  <img align="left" src="https://avatars0.githubusercontent.com/u/1140906?s=24">
</a>
<strong>Mateu Aguiló Bosch</strong>
<br><br>
<a title="Software architect with an interest in distributed systems and elegant solutions." href="https://github.com/elliotttf">
  <img align="left" src="https://avatars0.githubusercontent.com/u/447151?s=24">
</a>
<strong>Elliott Foster</strong>
<br><br>
</details>

<h2 id="license">License</h2>
<p>cache-tags is <a href="./LICENSE">MIT licensed</a>.</p>
