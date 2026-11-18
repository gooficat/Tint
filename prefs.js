import { ExtensionPreferences } from 'resource:///org/gnome/shell/extensions/extension.js';
import { Gtk } from 'gi://Gtk';
import { GObject } from 'gi://GObject';
import * as Gio from 'gi://Gio';

const FILTERS = ['none', 'greyscale', 'sepia', 'invert'];

export default class TintPreferences extends ExtensionPreferences {
    _init(me) {
        super._init();
    }

    _buildPrefsWindow() {
        const settings = this.getSettings();

        const window = new Gtk.Dialog();
        window.set_title('Tint');

        const content = window.get_content_area();
        const box = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 12,
        });
        box.set_marginTop(12);
        box.set_marginBottom(12);
        box.set_marginStart(12);
        box.set_marginEnd(12);
        content.append(box);

        const enableRow = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
            spacing: 12,
        });
        const enableLabel = new Gtk.Label({
            label: 'Enable colour filter',
        });
        const enableSwitch = new Gtk.Switch();
        enableSwitch.set_active(settings.get_boolean('enabled'));
        enableSwitch.connect(
            'notify::active',
            () => this._setEnabled(enableSwitch.get_active())
        );
        enableRow.append(enableLabel);
        enableRow.append(enableSwitch);
        box.append(enableRow);

        const filterRow = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
            spacing: 12,
        });
        const filterLabel = new Gtk.Label({
            label: 'Filter',
        });
        const filterDropdown = new Gtk.DropDown();
        const filterNames = new Gtk.StringList();
        FILTERS.forEach((filter) => filterNames.append(filter));
        filterDropdown.set_model(filterNames);
        const currentFilterIndex = FILTERS.indexOf(settings.get_string('filter'));
        filterDropdown.set_selected(currentFilterIndex >= 0 ? currentFilterIndex : 0);
        filterDropdown.connect(
            'notify::selected',
            () => this._setFilter(FILTERS[filterDropdown.get_selected()])
        );
        filterRow.append(filterLabel);
        filterRow.append(filterDropdown);
        box.append(filterRow);

        const strengthRow = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
            spacing: 12,
        });
        const strengthLabel = new Gtk.Label({
            label: 'Strength',
        });
        const strengthSpin = new Gtk.SpinButton();
        strengthSpin.set_range(0, 100);
        strengthSpin.set_increments(1, 1);
        strengthSpin.set_value(Math.round(settings.get_double('strength') * 100));
        strengthSpin.connect(
            'notify::value',
            () => this._setStrength(strengthSpin.get_value())
        );
        strengthRow.append(strengthLabel);
        strengthRow.append(strengthSpin);
        box.append(strengthRow);

        content.append(box);

        window.add_button('Close', Gtk.ResponseType.CLOSE);
        window.connect('response', (dialog, response) => {
            if (response === Gtk.ResponseType.CLOSE) {
                dialog.destroy();
            }
        });

        return window;
    }

    _setEnabled(active) {
        this.getSettings().set_boolean('enabled', active);
    }

    _setFilter(filter) {
        this.getSettings().set_string('filter', filter);
    }

    _setStrength(percent) {
        this.getSettings().set_double(
            'strength',
            Math.min(Math.max(percent, 0), 100) / 100
        );
    }
}
