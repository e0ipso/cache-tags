// @flow

const Redis = require('ioredis');
const RedisTaggedCache = require('./RedisTaggedCache');
const TagSet = require('./TagSet');

class TaggableRedis extends Redis {
  tags(names: Array<string>) {
    return new RedisTaggedCache(this, new TagSet(this, names));
  }
}

class TaggableCluster extends Redis.Cluster {
  tags(names: Array<string>) {
    return new RedisTaggedCache(this, new TagSet(this, names));
  }
}
TaggableRedis.Cluster = TaggableCluster;

module.exports = TaggableRedis;
