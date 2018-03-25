// @flow

const Redis = require('ioredis');
const RedisTaggedCache = require('./RedisTaggedCache');
const TagSet = require('./TagSet');

class TaggableRedis extends Redis {

  tags(names: Array<string>) {
    return new RedisTaggedCache(this, new TagSet(this, names));
  }

};

module.exports = TaggableRedis;
