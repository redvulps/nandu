import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk?version=4.0';

export class NetworksPage extends Gtk.Box {
  static {
    GObject.registerClass(
      {
        GTypeName: 'NanduNetworksPage',
        Template:
          'resource:///org/redvulps/nandu/dialogs/main/networks/networks-page.ui',
      },
      this
    );
  }

  constructor(params?: Partial<Gtk.Box.ConstructorProps>) {
    super(params);
  }
}
