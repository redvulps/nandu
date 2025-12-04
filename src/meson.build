gnome = import('gnome')

sources = files(
  'main.ts',
  'window.ts',
  'settings-manager.ts',
  'setup-dialog.ts',
  'container-item.ts',
  'compose-item.ts',
  'compose-detail.ts',
  'container-manager.ts',
  'docker/connection.ts',
  'docker/client.ts',
  'docker/types.ts',
  'docker/container/disk-usage.ts',
  'docker/container/logs.ts',
  'docker/container/monitor.ts',
  'docker/container/mounts.ts',
  'docker/container/network.ts',
  'docker/container/summary.ts',
  'models/container-info.ts',
  'utils/formatDate.ts',
  'utils/formatBytes.ts',
)

tsc_out = meson.project_build_root() / 'tsc-out'

typescript = custom_target(
  'typescript-compile',
  input: sources,
  build_by_default: true,
  build_always_stale: true,
  command: [ tsc, '--outDir', tsc_out ],
  output: ['tsc-output'],
)

src_res = gnome.compile_resources(
  'org.redvulps.nandu.src',
  'org.redvulps.nandu.src.gresource.xml',
  dependencies: typescript,
  source_dir: tsc_out,
  gresource_bundle: true,
  install: true,
  install_dir: pkgdatadir,
)

bin_conf = configuration_data()
bin_conf.set('GJS', gjs_console)
bin_conf.set('PACKAGE_VERSION', meson.project_version())
bin_conf.set('PACKAGE_NAME', meson.project_name())
bin_conf.set('prefix', get_option('prefix'))
bin_conf.set('libdir', join_paths(get_option('prefix'), get_option('libdir')))
bin_conf.set('datadir', join_paths(get_option('prefix'), get_option('datadir')))
bin_conf.set('resource_path', '/org/redvulps/nandu')

app_launcher = configure_file(
  input: 'org.redvulps.nandu.in',
  output: 'org.redvulps.nandu',
  configuration: bin_conf,
  install: true,
  install_dir: get_option('bindir')
)

run_target(
  'devel',
  command: [gjs_console, '-m', app_launcher],
  depends: [src_res, data_res, compile_local_schemas]
)