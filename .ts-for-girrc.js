export default {
  environments: ['gjs'],
  modules: ['Adw-1', 'Gtk-4.0', 'Gio-2.0', 'GObject-2.0', 'GLib-2.0'],
  outdir: './gi-types',
  buildType: 'types',
  moduleType: 'esm',
  promisify: true,
  npmScope: '@gi',
  package: false,
  verbose: true,
  ignoreVersionConflicts: true,
  print: false,
  noNamespace: false,
};
