let injections;

exports.activate = function () {
  injections = lumine.grammars.registerSyntaxModule(require.resolve("./syntax-injections"));
};

exports.deactivate = function () {
  injections?.dispose();
  injections = null;
};
