/* extension.js
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 2 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 *
 * SPDX-License-Identifier: GPL-2.0-or-later
 */
import GObject from 'gi://GObject';
import GLib from 'gi://GLib'
import Gio from 'gi://Gio'

import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import {Extension, gettext as _} from 'resource:///org/gnome/shell/extensions/extension.js';
import {QuickSlider, SystemIndicator} from 'resource:///org/gnome/shell/ui/quickSettings.js';

const BrightnessSlider = GObject.registerClass(
    class BrightnessSlider extends QuickSlider {

        _init(extensionObject) {
            super._init({
                iconName: 'video-display-symbolic',
            });
    
            // Watch for changes and set an accessible name for the slider
            this._sliderChangedId = this.slider.connect('notify::value',
                this._onSliderChanged.bind(this));
            this.slider.accessible_name = _('Studio Display Brightness Slider');

            setInterval(() => {
                this._update();
            }, 15000);

            this._update();
        }

        _update() {
            let argv = ["asdbctl", "get"]
            console.log("asdbctl-slider update")
            execCommunicate(argv).then(result => {
                console.log(result)
                let out = result.toString().trim().split(" ");
                    this.slider.value = out[1] / 100
                    this.visible = true
            
            }).catch(e => {
                this.visible = false
            })
            
        }
    
        _onSliderChanged() {
            // Assuming values between 0..100, adjust for the
            // slider taking values between 0..1
            const percent = Math.floor(this.slider.value * 100);
            GLib.spawn_command_line_async('asdbctl set '+percent)
        }
    });

const Indicator = GObject.registerClass(
class Indicator extends SystemIndicator {
    constructor() {
        super();

        this._indicator = this._addIndicator();
        const slider = new BrightnessSlider();
        this.quickSettingsItems.push(slider);
    }
});


 /**
     * Insert indicator and quick settings items at
     * appropriate positions
     *
     * @param {PanelMenu.Button} indicator
     * @param {number=} colSpan
     */
function addExternalIndicatorAtTop(indicator, colSpan = 1) {
    // Insert before first non-privacy indicator if it exists
    let sibling = Main.panel.statusArea.quickSettings._brightness ?? null;
    Main.panel.statusArea.quickSettings._indicators.insert_child_below(indicator, sibling);

    // Insert before network indicators
    sibling = Main.panel.statusArea.quickSettings._network?.quickSettingsItems?.at(0) ?? null;
    Main.panel.statusArea.quickSettings._addItemsBefore(indicator.quickSettingsItems, sibling, colSpan);

}


export default class QuickSettingsDisplayBrightness extends Extension {
    enable() {
        this._indicator = new Indicator();
        addExternalIndicatorAtTop(this._indicator, 2);

    }

    disable() {
        this._indicator.quickSettingsItems.forEach(item => item.destroy());
        this._indicator.destroy();
    }
}

// https://www.reddit.com/r/gnome/comments/gqvgeu/comment/frwgd5y/
function execCommunicate(argv) {
    let flags = (Gio.SubprocessFlags.STDOUT_PIPE |
                 Gio.SubprocessFlags.STDERR_PIPE);

    let proc = Gio.Subprocess.new(argv, flags);

    return new Promise((resolve, reject) => {
        proc.communicate_utf8_async(null, null, (proc, res) => {
            try {
                let [, stdout, stderr] = proc.communicate_utf8_finish(res);
                let status = proc.get_exit_status();

                if (status !== 0) {
                    throw new Gio.IOErrorEnum({
                        code: Gio.io_error_from_errno(status),
                        message: stderr ? stderr.trim() : GLib.strerror(status)
                    });
                }

                resolve(stdout.trim());
            } catch (e) {
                reject(e);
            }
        });
    });
}

