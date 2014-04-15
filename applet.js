const Applet = imports.ui.applet;
const Lang = imports.lang;
const PopupMenu = imports.ui.popupMenu;
const Mainloop = imports.mainloop;
const Settings = imports.ui.settings;  // Needed for settings API
const Gio = imports.gi.Gio
const Main = imports.ui.main;
const St = imports.gi.St;
const Clutter = imports.gi.Clutter;
const Gtk = imports.gi.Gtk;

const appletUUID = 'wallchanger';

///////////////////////////////////////////////////////////////////////////////
// Button object which when click, changes the wallpaper
// Add the "bin" actor member
///////////////////////////////////////////////////////////////////////////////
const ImageButton = new Lang.Class ({
  Name: 'ImageButton',

  _init : function (image_path)
  {
    this._image_path = image_path;
    
    let l = new Clutter.BinLayout();
    let c = new Clutter.Texture({width: 210, 
                                  keep_aspect_ratio: true, 
                                  filter_quality: 2, 
                                  filename: this._image_path});
		let b = new Clutter.Box();
		b.set_layout_manager(l);
    b.set_width(220);
		b.min_width = 220;
		b.min_height = c.height + 10;
    b.add_actor(c);
    this.bin = new St.Button({x_align: St.Align.START});
    this.bin.connect ('button-press-event', Lang.bind (this, this._onClick));
    this.bin.set_child(b);
  },

  _onClick: function() {
    let schema = Gio.SettingsSchemaSource.get_default();
    var gsettings = new Gio.Settings({ schema: 'org.gnome.desktop.background' });
    gsettings.set_string('picture-uri', "file://" + this._image_path);
  }

});

///////////////////////////////////////////////////////////////////////////////
// Container for folder_path
// Arguments:
// -folder_path: path of the folder that should be enumerated
///////////////////////////////////////////////////////////////////////////////
function ImageSection(folder_path) {
    this._init(folder_path);
}

ImageSection.prototype = {
    __proto__: PopupMenu.PopupBaseMenuItem.prototype,


    _init: function (folder_path) {
        PopupMenu.PopupBaseMenuItem.prototype._init.call(this, {focusOnHover: false});
        
        this.applicationsScrollBox = new St.ScrollView({ x_fill: true, 
                                                         y_fill: false, 
                                                         y_align: St.Align.START,
                                                         hscrollbar_policy: Gtk.PolicyType.NEVER,
                                                         vscrollbar_policy: Gtk.PolicyType.AUTOMATIC });
        this.applicationsScrollBox.set_auto_scrolling(true);
        let monitorHeight = Main.layoutManager.primaryMonitor.height;
        let scrollMax = 0.75*monitorHeight;
        this.applicationsScrollBox.style = " max-height:" + scrollMax + "px;";

        this.applicationsBox = new St.BoxLayout({ vertical:true });
        this.load_folder(folder_path);
        
        this.addActor(this.applicationsScrollBox);
    },

    load_folder: function(folder_path) {
      this.folder_path = folder_path;
      
      this.applicationsBox.destroy();
      this.applicationsBox = new St.BoxLayout({ vertical:true });
      
      // Populate applicationsBox with buttons
			let dir = Gio.file_new_for_path(this.folder_path);
			let dir_info = dir.query_file_type(Gio.FileQueryInfoFlags.NONE, null);
			if(dir_info == Gio.FileType.DIRECTORY) {

				let infos = dir.enumerate_children('standard::name,standard::type,standard::size',
				                                   Gio.FileQueryInfoFlags.NONE,
				                                   null);

				for(var f_info = infos.next_file(null); f_info != null; f_info = infos.next_file(null)) {
					let file = infos.get_child(f_info);
					try { this.applicationsBox.add_actor((new ImageButton(file.get_path())).bin); }
					catch(err) { }

				}
			}

      //TODO: monitor file for changes
			
      this.applicationsScrollBox.add_actor(this.applicationsBox);

    },

    activate: function (event) {
        return false;
    },

};

function MyApplet(metadata, orientation, panel_height, instance_id) {
    this._init(metadata, orientation, panel_height, instance_id); // Be sure to pass instanceId from the main function
}

MyApplet.prototype = {
    __proto__: Applet.TextIconApplet.prototype,

    _init: function(metadata, orientation, panel_height, instance_id) {
        Applet.TextIconApplet.prototype._init.call(this, orientation, panel_height, instance_id);
        
        Gtk.IconTheme.get_default().append_search_path(metadata.path);
        this.set_applet_icon_symbolic_name("wallchanger-icon");
        this.set_applet_tooltip(_("Wall Changer"));

        this.menuManager = new PopupMenu.PopupMenuManager(this);
        this.menu = new Applet.AppletPopupMenu(this, orientation);
        this.menuManager.addMenu(this.menu);

        this.settings = new Settings.AppletSettings(this, "wallchanger", instance_id);
        this.settings.bindProperty(Settings.BindingDirection.IN,
                                 "keybinding-test",
                                 "keybinding",
                                 this.on_keybinding_changed,
                                 null);
        this.settings.bindProperty(Settings.BindingDirection.IN,
                                 "folder",                       // Key in schema file
                                 "folder",                       // Sets this.folder
                                 this.on_settings_changed,       // Callback
                                 null);                          // Extra info sent to callback
        
        this.image_selector = new ImageSection(this.folder);
        this.menu.addMenuItem(this.image_selector);

        this.on_keybinding_changed();
        this.on_settings_changed();
    },

    on_keybinding_changed: function() {
        Main.keybindingManager.addHotKey("must-be-unique-id", this.keybinding, Lang.bind(this, this.on_hotkey_triggered));
    },

    on_settings_changed: function() {
        this.image_selector.load_folder(this.folder);
    },

    on_hotkey_triggered: function() {
        this.menu.toggle();
    },

    on_applet_clicked: function(event) {
        this.menu.toggle();
    },

    on_applet_removed_from_panel: function() {
        this.settings.finalize();    // This is called when a user removes the applet from the panel.. we want to
                                     // Remove any connections and file listeners here, which our settings object
                                     // has a few of
    }
};

function main(metadata, orientation, panel_height, instance_id) {  // Make sure you collect and pass on instanceId
    let myApplet = new MyApplet(metadata, orientation, panel_height, instance_id);
    return myApplet;
}

