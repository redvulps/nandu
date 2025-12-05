import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk?version=4.0';

export class ImagesPage extends Gtk.Box {
  static {
    GObject.registerClass(
      {
        GTypeName: 'NanduImagesPage',
        Template:
          'resource:///org/redvulps/nandu/dialogs/main/images/images-page.ui',
      },
      this
    );
  }

  constructor(params?: Partial<Gtk.Box.ConstructorProps>) {
    super(params);
  }
}
