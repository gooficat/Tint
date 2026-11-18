PREFIX ?= /usr
DESTDIR ?=

SCHEMA_DIR = $(DESTDIR)$(PREFIX)/share/glib-2.0/schemas
EXTENSION_DIR = $(HOME)/.local/share/gnome-shell/extensions
EXTENSION_ID = org.gnome.Tint

install: compile-schemas
	mkdir -p $(EXTENSION_DIR)/$(EXTENSION_ID)
	cp metadata.json extension.js prefs.js $(EXTENSION_DIR)/$(EXTENSION_ID)/
	glib-compile-schemas --targetdir=$(SCHEMA_DIR) schemas

compile-schemas:
	glib-compile-schemas --targetdir=$(SCHEMA_DIR) schemas

uninstall:
	rm -rf $(EXTENSION_DIR)/$(EXTENSION_ID)
	rm -f $(SCHEMA_DIR)/org.gnome.Tint.gschema.compiled

clean:
	rm -f schemas/gschemas.compiled
