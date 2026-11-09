// query-string 7 requires a callable CommonJS export. The fixed upstream is ESM.
// Keep its API while using the linear decoder that fixes the malformed-input DoS.
module.exports = require('decode-uri-component-upstream').default;
