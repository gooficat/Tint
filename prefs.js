import { ExtensionPreferences } from 'resource:///org/gnome/shell/extensions/extension.js';
import { Gtk } from 'gi://Gtk';
import { GObject } from 'gi://GObject';
import * as Gio from 'gi://Gio';

const FILTERS = ['none', 'greyscale', 'sepia', 'invert', 'tint'];

function parseHexRgba(hexColor) {
    let r = 1;
    let g = 1;
    let b = 1;
    let a = 1;
    if (typeof hexColor === 'string') {
        const hex = hexColor.replace(/^#/, '').trim();
        if (hex.length >= 6) {
            r = parseInt(hex.slice(0, 2), 16) / 255;
            g = parseInt(hex.slice(2, 4), 16) / 255;
            b = parseInt(hex.slice(4, 6), 16) / 255;
            if (hex.length >= 8) {
                a = parseInt(hex.slice(6, 8), 16) / 255;
            }
        }
    }
    return { r, g, b, a };
}

function toHexColor(r, g, b, a) {
    const channel = (value) =>
        Math.round(Math.min(Math.max(Number(value) || 0, 0), 1) * 255)
            .toString(16)
            .padStart(2, '0');
    return `#${channel(r)}${channel(g)}${channel(b)}${channel(a)}`;
}

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

        const colourRow = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
            spacing: 12,
        });
        const colourLabel = new Gtk.Label({
            label: 'Tint colour',
        });
        const colourDialog = new Gtk.ColorDialog();
        colourDialog.set_with_alpha(true);
        colourDialog.set_title('Tint colour');
        const colourButton = new Gtk.ColorDialogButton(colourDialog);
        colourButton.set_rgba(this._buildTintRgba());
        colourButton.connect(
            'notify::rgba',
            (sender) => this._onTintColorChanged(sender)
        );
        colourRow.append(colourLabel);
        colourRow.append(colourButton);
        box.append(colourRow);

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

    _buildTintRgba() {
        const rgba = parseHexRgba(this.getSettings().get_string('tint-color'));
        return { red: rgba.r, green: rgba.g, blue: rgba.b, alpha: rgba.a };
    }

    _onTintColorChanged(button) {
        const rgba = button.get_rgba();
        const red = Number(rgba.red ?? rgba.r);
        const green = Number(rgba.green ?? rgba.g);
        const blue = Number(rgba.blue ?? rgba.b);
        const alpha = Number(rgba.alpha ?? rgba.a);
        this.getSettings().set_string('tint-color', toHexColor(red, green, blue, alpha));
        this._setFilter('tint');
    }
}
