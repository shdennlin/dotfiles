require('shdennlin.base')
require('shdennlin.highlights')
require('shdennlin.maps')
require('shdennlin.plugins')

local has = vim.fn.has
local is_mac = has "macunix"
local is_win = has "win32"

if is_mac then
  require('shdennlin.macos')
end
if is_win then
  require('shdennlin.windows')
end