// The parent's delimiter characters remain untouched, and an existing
// nonblank prefix prevents changes to line-leading structural indentation.
const boundaries = new Set(["`", "~", "$", "\\", "<", ">", "-"]);

module.exports = function contentEditPolicy({ before, oldText, newText, after }) {
  if (!/\S/.test(before) || !/^[A-Za-z0-9_ ]*$/.test(oldText + newText)) return false;
  for (const character of before + oldText + after) if (boundaries.has(character)) return false;
  return true;
};
