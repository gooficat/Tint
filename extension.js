/**
 * Tint – Colour filter extension for GNOME.
 *
 * Applies user-configurable colour filters (greyscale, sepia, inversion) to
 * the whole screen by wrapping the GNOME Shell UI group in a hidden Clutter
 * clone and attaching a shader effect that runs while the clone is rendered.
 */

import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';
import GObject from 'gi://GObject';
import Shell from 'gi://Shell';
import St from 'gi://St';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';

import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';

const SETTINGS_SCHEMA = 'org.gnome.Tint';
const FILTER_NONE = 'none';
const FILTER_GREYSCALE = 'greyscale';
const FILTER_SEPIA = 'sepia';
const FILTER_INVERT = 'invert';
const FILTER_TINT = 'tint';

const GREYSCALE_SHADER_SOURCE = `
    uniform sampler2D tex;
    uniform float STRENGTH;

    void main() {
        vec4 c = texture2D(tex, cogl_tex_coord_in[0].st);
        float luma = dot(c.rgb, vec3(0.2126, 0.7152, 0.0722));
        vec3 grey = vec3(luma, luma, luma);
        cogl_color_out = vec4(mix(c.rgb, grey, STRENGTH), c.a);
    }
`;

const SEPIA_SHADER_SOURCE = `
    uniform sampler2D tex;
    uniform float STRENGTH;

    void main() {
        vec4 c = texture2D(tex, cogl_tex_coord_in[0].st);
        vec3 rgb = c.rgb;
        vec3 sepia;
        sepia.r = 0.393 * rgb.r + 0.769 * rgb.g + 0.189 * rgb.b;
        sepia.g = 0.349 * rgb.r + 0.686 * rgb.g + 0.168 * rgb.b;
        sepia.b = 0.272 * rgb.r + 0.534 * rgb.g + 0.131 * rgb.b;
        cogl_color_out = vec4(mix(rgb, sepia, STRENGTH), c.a);
    }
`;

const INVERT_SHADER_SOURCE = `
    uniform sampler2D tex;
    uniform float STRENGTH;

    void main() {
        vec4 c = texture2D(tex, cogl_tex_coord_in[0].st);
        vec3 inverted = vec3(
            pow(1.0 - c.r, 1.0 / 2.2),
            pow(1.0 - c.g, 1.0 / 2.2),
            pow(1.0 - c.b, 1.0 / 2.2)
        );
        cogl_color_out = vec4(mix(c.rgb, inverted, STRENGTH), c.a);
    }
`;

const TINT_SHADER_SOURCE = `
    uniform sampler2D tex;
    uniform float STRENGTH;
    uniform float TINT_R;
    uniform float TINT_G;
    uniform float TINT_B;
    uniform float TINT_A;

    void main() {
        vec4 c = texture2D(tex, cogl_tex_coord_in[0].st);
        vec3 tint = vec3(TINT_R, TINT_G, TINT_B);
        vec3 tinted = mix(c.rgb, tint, TINT_A);
        cogl_color_out = vec4(mix(c.rgb, tinted, STRENGTH), c.a);
    }
`;

/**
 * Parses a hexadecimal colour of the #rrggbbaa format (e.g. #ff0000ff for
 * opaque red or #80ff0000 for semi-transparent red) into its RGBA components.
 */
function parseTintColor(colorString) {
    let r = 1;
    let g = 1;
    let b = 1;
    let a = 1;
    if (typeof colorString === 'string') {
        const hex = colorString.replace(/^#/, '').trim();
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

const GreyscaleEffect = GObject.registerClass(
class GreyscaleEffect extends Clutter.ShaderEffect {
    _init(properties) {
        super._init();
        this.updateEffect(properties);
        this.set_shader_source(GREYSCALE_SHADER_SOURCE);
    }

    updateEffect(properties) {
        this.strength = properties.strength;
        this.queue_repaint();
    }

    vfunc_get_static_shader_source() {
        return GREYSCALE_SHADER_SOURCE;
    }

    vfunc_paint_target(...args) {
        this.set_uniform_value('tex', 0);
        this.set_uniform_value('STRENGTH', this.strength);
        super.vfunc_paint_target(...args);
    }
});

const SepiaEffect = GObject.registerClass(
class SepiaEffect extends Clutter.ShaderEffect {
    _init(properties) {
        super._init();
        this.updateEffect(properties);
        this.set_shader_source(SEPIA_SHADER_SOURCE);
    }

    updateEffect(properties) {
        this.strength = properties.strength;
        this.queue_repaint();
    }

    vfunc_get_static_shader_source() {
        return SEPIA_SHADER_SOURCE;
    }

    vfunc_paint_target(...args) {
        this.set_uniform_value('tex', 0);
        this.set_uniform_value('STRENGTH', this.strength);
        super.vfunc_paint_target(...args);
    }
});

const InvertEffect = GObject.registerClass(
class InvertEffect extends Clutter.ShaderEffect {
    _init(properties) {
        super._init();
        this.updateEffect(properties);
        this.set_shader_source(INVERT_SHADER_SOURCE);
    }

    updateEffect(properties) {
        this.strength = properties.strength;
        this.queue_repaint();
    }

    vfunc_get_static_shader_source() {
        return INVERT_SHADER_SOURCE;
    }

    vfunc_paint_target(...args) {
        this.set_uniform_value('tex', 0);
        this.set_uniform_value('STRENGTH', this.strength);
        super.vfunc_paint_target(...args);
    }
});

const TintEffect = GObject.registerClass(
    class TintEffect extends Clutter.ShaderEffect {
        _init(properties) {
            super._init();
            this.updateEffect(properties);
            this.set_shader_source(TINT_SHADER_SOURCE);
        }

        updateEffect(properties) {
            this.strength = properties.strength;
            this.tintR = properties.tintR;
            this.tintG = properties.tintG;
            this.tintB = properties.tintB;
            this.tintA = properties.tintA;
            this.queue_repaint();
        }

        vfunc_get_static_shader_source() {
            return TINT_SHADER_SOURCE;
        }

        vfunc_paint_target(...args) {
            this.set_uniform_value('tex', 0);
            this.set_uniform_value('STRENGTH', this.strength);
            this.set_uniform_value('TINT_R', this.tintR);
            this.set_uniform_value('TINT_G', this.tintG);
            this.set_uniform_value('TINT_B', this.tintB);
            this.set_uniform_value('TINT_A', this.tintA);
            super.vfunc_paint_target(...args);
        }
    }
);

/**
 * Renders a clone of the UI group (i.e. the desktop content) into which the
 * active colour filter effect is attached. The clone is added to the stage
 * only while an effect is set, and any screen magnifier is filtered as well.
 */
class EffectTarget {
    constructor() {
        this._currentEffect = null;
        this._magnifier = null;

        this._uiGroupClone = new Clutter.Clone({
            source: Main.uiGroup,
            clip_to_allocation: true,
        });
        Shell.util_set_hidden_from_pick(this._uiGroupClone, true);

        const stage = Shell.Global.get().stage;
        this._stageChildAddedId = stage.connect(
            'child-added',
            (_stage, actor) => this._onStageAttach(actor)
        );
        stage.get_children().forEach((child) => this._onStageAttach(child));
    }

    destroy() {
        const stage = Shell.Global.get().stage;
        stage.disconnect(this._stageChildAddedId);
        this.set_effect(null);
        this._set_magnifier(null);
        this._uiGroupClone.destroy();
    }

    set_effect(effect) {
        if (effect === this._currentEffect) {
            return;
        }

        const source = this._magnifier ? this._magnifier.source : this._uiGroupClone;

        if (this._currentEffect) {
            source.remove_effect(this._currentEffect);
        } else if (source === this._uiGroupClone) {
            Shell.Global.get().stage.add_child(this._uiGroupClone);
        }

        this._currentEffect = effect;

        if (this._currentEffect) {
            source.add_effect(this._currentEffect);
        } else if (source === this._uiGroupClone) {
            Shell.Global.get().stage.remove_child(this._uiGroupClone);
        }
    }

    _onStageAttach(actor) {
        const styleClasses = actor.style_class ? actor.style_class.split(' ') : [];
        const isMagnifier = styleClasses.some(
            (styleClass) => styleClass === 'magnifier-zoom-region'
        );
        if (!isMagnifier) {
            return;
        }

        const destroyId = actor.connect('destroy', () => this._set_magnifier(null));
        this._set_magnifier({ source: actor, destroyConn: destroyId });
    }

    _set_magnifier(magnifier) {
        if (this._magnifier) {
            this._magnifier.source.disconnect(this._magnifier.destroyConn);
        }
        this._magnifier = magnifier;
        this.set_effect(this._currentEffect);
    }
}

const MenuButton = GObject.registerClass(
class MenuButton extends PanelMenu.Button {
    _init(me, ext) {
        super._init(0.5, 'Tint', false);
        this._ext = ext;

        this._filterItems = {};
        this._activeFilter = FILTER_NONE;
        this._switch = null;

        const switchItem = new PopupMenu.PopupSwitchMenuItem('Tint', false);
        switchItem.connect('toggled', () => this._onSwitchToggled());
        this.menu.addMenuItem(switchItem);
        this._switch = switchItem._switch;

        const greyscaleItem = new PopupMenu.PopupMenuItem('Greyscale', false);
        greyscaleItem.connect('activate', () => this._onFilterSelected(FILTER_GREYSCALE));
        this.menu.addMenuItem(greyscaleItem);
        this._filterItems[FILTER_GREYSCALE] = greyscaleItem;

        const sepiaItem = new PopupMenu.PopupMenuItem('Sepia', false);
        sepiaItem.connect('activate', () => this._onFilterSelected(FILTER_SEPIA));
        this.menu.addMenuItem(sepiaItem);
        this._filterItems[FILTER_SEPIA] = sepiaItem;

        const invertItem = new PopupMenu.PopupMenuItem('Invert', false);
        invertItem.connect('activate', () => this._onFilterSelected(FILTER_INVERT));
        this.menu.addMenuItem(invertItem);
        this._filterItems[FILTER_INVERT] = invertItem;

        const tintItem = new PopupMenu.PopupMenuItem('Tint', false);
        tintItem.connect('activate', () => this._onFilterSelected(FILTER_TINT));
        this.menu.addMenuItem(tintItem);
        this._filterItems[FILTER_TINT] = tintItem;
    }

    _onSwitchToggled() {
        this._ext.setEnabled(this._switch.state);
    }

    _onFilterSelected(filter) {
        this._setActiveFilter(filter);
        this._ext.setFilter(filter);
    }

    _setActiveFilter(filter) {
        this._activeFilter = filter;
        for (const key in this._filterItems) {
            this._filterItems[key].setOrnament(
                key === filter ? PopupMenu.Ornament.DOT : PopupMenu.Ornament.NONE
            );
        }
    }

    _setSwitchActive(active) {
        if (this._switch) {
            this._switch.set_active(active);
        }
    }
});

export default class Tint extends Extension {
    enable() {
        this._settings = this.getSettings();
        this._effectTarget = new EffectTarget();

        this._menu = new MenuButton(this);
        this._menu._ext = this;
        this._menu.add_child(
            new St.Icon({
                gicon: Gio.icon_new_for_string('color-select-symbolic'),
                icon_size: 16,
            })
        );
        Main.panel.addToStatusArea('Tint', this._menu, 0, 'right');

        this._settingsChangedId = this._settings.connect(
            'changed',
            (settings, key) => this._onSettingsChanged(key)
        );

        this._applyFilter();
    }

    disable() {
        this._settings.disconnect(this._settingsChangedId);
        this._effectTarget.destroy();
        this._menu.destroy();
        this._menu = null;
    }

    _onSettingsChanged(key) {
        if (
            key === 'enabled' ||
            key === 'filter' ||
            key === 'strength' ||
            key === 'tint-color'
        ) {
            this._applyFilter();
        }
    }

    setEnabled(enabled) {
        this._settings.set_boolean('enabled', enabled);
        this._applyFilter();
    }

    setFilter(filter) {
        this._settings.set_string('filter', filter);
        this._applyFilter();
    }

    _applyFilter() {
        const enabled = this._settings.get_boolean('enabled');
        const filter = this._settings.get_string('filter');
        const strength = Math.min(Math.max(this._settings.get_double('strength'), 0), 1);

        let effect = null;
        if (enabled && filter !== FILTER_NONE) {
            const properties = { strength: strength };
            switch (filter) {
                case FILTER_GREYSCALE:
                    effect = new GreyscaleEffect(properties);
                    break;
                case FILTER_SEPIA:
                    effect = new SepiaEffect(properties);
                    break;
                case FILTER_INVERT:
                    effect = new InvertEffect(properties);
                    break;
                case FILTER_TINT: {
                    const tint = parseTintColor(this._settings.get_string('tint-color'));
                    effect = new TintEffect({
                        strength: strength,
                        tintR: tint.r,
                        tintG: tint.g,
                        tintB: tint.b,
                        tintA: tint.a,
                    });
                    break;
                }
                default:
                    effect = null;
            }
        }

        this._effectTarget.set_effect(effect);

        if (this._menu) {
            this._menu._setActiveFilter(enabled ? filter : FILTER_NONE);
            this._menu._setSwitchActive(enabled);
        }
    }
}
