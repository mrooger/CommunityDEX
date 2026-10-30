'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const css = fs.readFileSync(path.join(__dirname,'../app.css'),'utf8');
const js = fs.readFileSync(path.join(__dirname,'../app.js'),'utf8');
const manifest = require('../manifest.json');

test('Pokédex action row wraps on narrow Complete Dex widths', () => {
  assert.match(css, /#sd-panel \.sd-pokemon-actions\{flex-wrap:wrap!important;/);
  assert.doesNotMatch(css, /#sd-panel \.sd-pokemon-actions\{flex-wrap:nowrap!important;/);
  assert.match(css, /#sd-panel \.sd-pokemon-actions>\.sd-pill\{max-width:100%/);
});
test('Update panel shows installed version rather than test badge', () => {
  assert.equal(manifest.version,'1.4.0');
  assert.doesNotMatch(js, /Versão de teste/);
  assert.match(js, /ahead\?`<span class="sd-pill sd-green">v\$\{E\(INSTALLED_VERSION\)\}<\/span>`/);
});
