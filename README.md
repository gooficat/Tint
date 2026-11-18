# Tint

**Colour filter extension for GNOME**

Tint applies configurable colour filters to the whole screen, so that
applications, documents and the desktop can be viewed through a different
colour presentation.

## Features

- Toggle the colour filter on and off from the panel.
- Choose between several colour filters:
  - **Greyscale** – desaturate the screen.
  - **Sepia** – apply a sepia tone.
  - **Invert** – invert the colours of the screen.
- Adjust the filter strength (0 – 100 %, where 0 disables filtering and 100 %
  applies the filter fully).

Filters are applied to the desktop content rendered by GNOME Shell and can be
adjusted at runtime.

## Installation

### GNOME 45 and newer

```sh
git clone https://github.com/gooficat/Tint.git
cd Tint
make install
gnome-extensions enable org.gnome.Tint
```

`make install` copies the extension into `~/.local/share/gnome-shell/extensions/org.gnome.Tint/`
and compiles the `org.gnome.Tint` GSettings schema. If you prefer to compile
the schema manually:

```sh
glib-compile-schemas /usr/share/glib-2.0/schemas
```


### Flatpak

If GNOME is running inside Flatpak, install the extension inside the
`org.gnome.GNOME` runtime sandbox, e.g. by copying the extension into

```sh
~/.var/app/org.gnome.GNOME/config/gnome-shell/extensions/
```

and restarting the shell.

## Configuration

Open the extension preferences from the panel menu, from the GNOME
extensions app, or from the control centre, using the *Tint* entry.

- **Enable** – enable or disable the colour filter.
- **Filter** – select the colour filter to apply.
- **Strength** – set the strength of the filter.

The current state is stored in the `org.gnome.Tint` GSettings schema and is
applied immediately.

## Troubleshooting

- Make sure the extension is enabled: `gnome-extensions list`.
- Check the logs in `journalctl --user` for extension errors.
- If the filter does not appear, restart GNOME Shell.

## License

This project is licensed under the [GNU Affero General Public License v3.0](LICENSE).
