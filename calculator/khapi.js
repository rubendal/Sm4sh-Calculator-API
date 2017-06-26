﻿class HitboxActiveFrames {
	constructor(start, end) {
		this.start = start;
		this.end = end;
	}
};

class CancelCond {
	constructor(cond) {
		this.rawValue = cond;
		if (cond.includes("&gt;")) {
			//Greater than
			this.type = ">";
			this.value = parseFloat(cond.replace("&gt;", "")) - 1;
			this.values = null;
			this.print = function () {
				return this.value + ">";
			}
			this.eval = function (value) {
				return this.value < value;
			}
		} else {
			if (/[0-9]+\-[0-9]+/i.test(cond)) {
				//Range
				this.type = "-";
				this.value = null;
				this.values = [parseFloat(cond.split("-")[0]), parseFloat(cond.split("-")[1])];
				this.print = function () {
					return this.value[0] + "-" + this.value[1];
				}
				this.eval = function (value) {
					return value >= this.values[0] && value <= this.values[1];
				}
			} else {
				this.type = "empty";
				this.value = null;
				this.values = null;
				this.print = function () {
					return "-";
				}
				this.eval = function (value) {
					return false;
				}
			}
		}
	}
}

class MoveParser {
	constructor(id, name, base_damage, angle, bkb, kbg, hitboxActive, faf, landingLag, autoCancel, ignore_hitboxes) {
		this.id = id;
		this.name = name;
		this.angle = angle;
		this.faf = faf;

		this.base_damage = base_damage;
		this.bkb = bkb;
		this.kbg = kbg;

		this.preDamage = 0;
		this.throw = name.includes("Fthrow") || name.includes("Bthrow") || name.includes("Uthrow") || name.includes("Dthrow");
		this.aerial = name.includes("Uair") || name.includes("Fair") || name.includes("Bair") || name.includes("Dair") || name.includes("Nair") || name.includes("Zair");
		this.grab = this.name == "Standing Grab" || this.name == "Dash Grab" || this.name == "Pivot Grab";

		this.landingLag = "-";
		this.autoCancel = [];

		this.counterMult = 0;
		var counterRegex = /(\([0-9]+(\.[0-9]+)*&#215;\))/i;

		this.shieldDamage = 0;
		var shieldDamageRegex = /\(\+[0-9]+\)/i;

		if (!this.throw) {
			this.hitboxActive = parseHitbox(hitboxActive);
		} else {
			this.hitboxActive = parseHitbox("-");
			this.faf = NaN;
			var throwdamage = this.base_damage.split(",");
			if (throwdamage.length > 0) {
				for (var i = 0; i < throwdamage.length - 1; i++) {
					throwdamage[i] = throwdamage[i].replace("&#37;", "").replace("%", "").replace("&#215;", "x");
					var value = 0;
					if (throwdamage[i].includes("x")) {
						value = parseFloat(throwdamage[i].split("x")[0]) * parseFloat(throwdamage[i].split("x")[1]);
					}
					else {
						value = parseFloat(throwdamage[i]);
					}
					this.preDamage += value;

				}
				this.base_damage = throwdamage[throwdamage.length - 1];
			}
		}

		if (counterRegex.test(this.base_damage)) {
			var c = counterRegex.exec(this.base_damage)[0].replace(/[a-z]|\(|\)/gi, "").replace("&#215;", "");
			this.counterMult = parseFloat(c);
		}

		this.hitboxes = this.hitboxActive;

		var rehitRateRegex = /(Rehit rate: [0-9]+)/i;
		this.rehitRate = 0;

		if (rehitRateRegex.test(hitboxActive)) {
			this.rehitRate = parseFloat(/[0-9]+/i.exec(rehitRateRegex.exec(hitboxActive)[0])[0]);
		}

		this.count = 1;
		this.moves = [];
		var wbkb = 0;

		var damage = [];
		var angles = [];
		var kbgs = [];
		var bkbs = [];
		var fkbs = [];

		if (shieldDamageRegex.test(this.base_damage)) {
			this.shieldDamage = parseFloat(shieldDamageRegex.exec(this.base_damage)[0].replace(/\+|\(|\)/gi, ""));
		}

		if (this.aerial) {
			this.landingLag = parseFloat(landingLag);
			var cancels = autoCancel.split(",");
			for (var i = 0; i < cancels.length; i++) {
				this.autoCancel.push(new CancelCond(cancels[i]));
			}
		}

		if (this.base_damage !== undefined && this.bkb !== undefined && this.kbg !== undefined && this.angle !== undefined) {
			if (this.base_damage == "-" || this.base_damage == "" || this.base_damage == "?") {
				this.base_damage = "";
			}
			if (this.angle == "-" || this.angle == "" || this.angle == "?") {
				this.angle = "";
			}
			if (this.bkb == "-" || this.bkb == "" || this.bkb == "?") {
				this.bkb = "";
			}
			if (this.kbg == "-" || this.kbg == "" || this.kbg == "?") {
				this.kbg = "";
			}
			var hitbox = parseHitbox();

			var ryu_true = /\(True: [0-9]+(\.[0-9]+)*\)/gi;
			var is_ryu_special = false;

			if (ryu_true.test(this.base_damage)) {
				is_ryu_special = true;
				this.base_damage = this.base_damage.split('(')[0] + "/" + this.base_damage.split(':')[1].replace(')', "");
			}

			if (this.base_damage.includes("/") || this.bkb.includes("/") || this.kbg.includes("/") || this.angle.includes("/")) {
				//multiple hitboxes
				var first_fkb = false;
				var multi_bkb_wbkb = false;
				var sbkb = 0;
				damage = this.base_damage.split("/");
				angles = this.angle.split("/");
				kbgs = this.kbg.split("/");

				if (shieldDamageRegex.test(damage[damage.length - 1])) {
					this.shieldDamage = parseFloat(shieldDamageRegex.exec(damage[damage.length - 1])[0].replace(/\+|\(|\)/gi, ""));
				}

				if (this.bkb.includes("W: ") && this.bkb.includes("B: ")) {
					this.bkb = this.bkb.replace("/W:", "W:").replace("/B:", "B:").split(",").join("");
					var w = this.bkb.split("W:");
					if (w[1].includes("B:")) {
						var b = w[1].split("B:")[1];
						w = w[1].split("B:")[0];
						fkbs = w.trim().split("/");
						bkbs = b.trim().split("/");
						first_fkb = true;
					} else {
						var b = this.bkb.split("B:")[1];
						w = b.split("W:")[1];
						b = b.trim().split("W:")[0];
						fkbs = w.trim().split("/");
						bkbs = b.trim().split("/");
					}
					var m = Math.max(damage.length, angles.length, kbgs.length);
					if (m == fkbs.length) {
						sbkb = bkbs[0];
						multi_bkb_wbkb = true;
					}
				} else {
					if (this.bkb.includes("W: ")) {
						var v = this.bkb.split("/");
						//Check if W: is on the first hitbox (this often means all hitboxes are WBKB)
						if (v[0].includes("W: ")) {
							fkbs = this.bkb.replace("W:", "").trim().split("/");
							first_fkb = true;
						} else {
							//Splitted in BKB and WBKB, however there is no B: indicator to know which are BKB, so every value before W: will be considered BKB
							var wb = false;
							bkbs = [];
							fkbs = [];
							for (var i = 0; i < v.length; i++) {
								if (v[i].includes("W: ")) {
									fkbs.push(v[i].replace("W:", "").trim());
									wb = true;
								} else {
									if (wb) {
										fkbs.push(v[i]);
									} else {
										bkbs.push(v[i]);
									}
								}
							}
						}
					} else {
						bkbs = this.bkb.split("/");
					}
				}

				var hitbox_count = Math.max(damage.length, angles.length, kbgs.length, multi_bkb_wbkb ? fkbs.length : (fkbs.length + bkbs.length));
				var set_count = 0;
				var base_count = 0;
				for (var i = 0; i < hitbox_count; i++) {
					var hitbox_name = this.name;
					if (!is_ryu_special) {
						if (!ignore_hitboxes) {
							hitbox_name += " (Hitbox " + (i + 1) + ")";
						}
					} else {
						if (i == 1) {
							hitbox_name = "True " + hitbox_name;
						}
					}

					var d = i < damage.length ? damage[i] : damage[damage.length - 1];
					var a = i < angles.length ? angles[i] : angles[angles.length - 1];
					var k = i < kbgs.length ? kbgs[i] : kbgs[kbgs.length - 1];
					var b = 0;

					var s = 0;
					if (this.shieldDamage == 0) {
						if (shieldDamageRegex.test(d)) {
							s = parseFloat(shieldDamageRegex.exec(d)[0].replace(/\+|\(|\)/gi, ""));
						}
					} else {
						s = this.shieldDamage;
					}

					if (multi_bkb_wbkb) {
						wbkb = fkbs[set_count]
						b = sbkb;
					} else {
						if (first_fkb) {
							if (set_count < fkbs.length) {
								b = "0";
								wbkb = fkbs[set_count];
								set_count++;
							} else {
								if (bkbs.length > 0) {
									b = bkbs[base_count];
									wbkb = "0";
									base_count++;
								} else {
									b = "0";
									wbkb = fkbs[fkbs.length - 1];
								}
							}
						} else {
							if (base_count < bkbs.length) {
								b = bkbs[base_count];
								wbkb = "0";
								base_count++;
							} else {
								if (fkbs.length > 0) {
									b = "0";
									wbkb = fkbs[set_count];
									set_count++;
								} else {
									b = bkbs[bkbs.length - 1];
									wbkb = "0";
								}
							}
						}
					}
					this.moves.push(new Move(this.id, i, hitbox_name, this.name, parseFloat(d), parseFloat(a), parseFloat(b), parseFloat(k), parseFloat(wbkb), this.hitboxes, parseFloat(this.faf), parseFloat(this.landingLag), this.autoCancel, this.preDamage, this.counterMult, this.rehitRate, s));
					if (ignore_hitboxes) {
						return;
					}
				}
			} else {
				//single hitbox
				if (this.bkb.includes("W: ") && this.bkb.includes("B: ")) {
					this.bkb = this.bkb.replace("/W:", "W:").replace("/B:", "B:").split(",").join("");
					var w = this.bkb.split("W:");
					if (w[1].includes("B:")) {
						var b = w[1].split("B:")[1];
						w = w[1].split("B:")[0];
						fkbs = w.trim().split("/");
						bkbs = b.trim().split("/");
						first_fkb = true;
					} else {
						var b = this.bkb.split("B:")[1];
						w = b.split("W:")[1];
						b = b.trim().split("W:")[0];
						fkbs = w.trim().split("/");
						bkbs = b.trim().split("/");
					}
					this.bkb = bkbs[0];
					wbkb = fkbs[0];
				} else {
					if (bkb.includes("W: ")) {
						this.bkb = "0";
						wbkb = bkb.replace("W: ", "");
					}
				}
				if (this.base_damage == "" && this.angle == "" && this.bkb == "" && this.kbg == "") {
					if (this.grab) {
						this.moves.push(new Move(this.id, 0, this.name, this.name, NaN, NaN, NaN, NaN, NaN, this.hitboxes, parseFloat(this.faf), parseFloat(this.landingLag), this.autoCancel, this.preDamage, this.counterMult, this.rehitRate, this.shieldDamage));
					} else {
						this.moves.push(new Move(this.id, 0, this.name, this.name, NaN, NaN, NaN, NaN, NaN, this.hitboxes, parseFloat(this.faf), parseFloat(this.landingLag), this.autoCancel, this.preDamage, this.counterMult, this.rehitRate, this.shieldDamage).invalidate());
					}
				} else {
					this.moves.push(new Move(this.id, 0, this.name, this.name, parseFloat(this.base_damage), parseFloat(this.angle), parseFloat(this.bkb), parseFloat(this.kbg), parseFloat(wbkb), this.hitboxes, parseFloat(this.faf), parseFloat(this.landingLag), this.autoCancel, this.preDamage, this.counterMult, this.rehitRate, this.shieldDamage));
				}
			}

		} else {
			this.moves.push(new Move(this.id, 0, this.name, this.name, NaN, NaN, NaN, NaN, NaN, [new HitboxActiveFrames(NaN, NaN)], NaN, parseFloat(this.landingLag), this.autoCancel, 0, this.counterMult, this.rehitRate, this.shieldDamage).invalidate());
		}


		function parseHitbox(hitboxActive) {
			var result = [];
			if (hitboxActive === undefined) {
				return [new HitboxActiveFrames(NaN, NaN)];
			}
			if (hitboxActive == "") {
				return [new HitboxActiveFrames(NaN, NaN)];
			}
			hitboxActive = hitboxActive.replace(/[a-z]|\?|\(.+\)|\:/gi, "");
			var hitbox = hitboxActive.split(",");
			for (var i = 0; i < hitbox.length; i++) {
				var start = hitbox[i].split("-")[0];
				var end = hitbox[i].split("-")[1];
				if (start == undefined) {
					start = "0";
				}
				if (end == undefined) {
					end = "0";
				}
				result.push(new HitboxActiveFrames(parseFloat(start), parseFloat(end)));
			}
			return result;
		}
	}
}

var previousMove = null;

class ChargeData {
	constructor(names, min, max, formula, variable_bkb) {
		this.names = names;
		this.min = min;
		this.max = max;
		this.formula = formula;
		if (variable_bkb == undefined) {
			this.variable_bkb = false;
		} else {
			this.variable_bkb = variable_bkb;
		}
	}

	static get(list, move_name) {
		for (var i = 0; i < list.length; i++) {
			for (var j = 0; j < list[i].names.length; j++) {
				if (move_name.includes(list[i].names[j])) {
					return list[i];
				}
			}
		}
		return null;
	}
};

var chargeMoves = [
	new ChargeData(["Palutena's Bow (No Charge)", "Palutena's Bow (No Charge, Aerial)"], 1, 60, function (base_damage, bkb, frames) {
		return [3.2 + (frames * 0.09), bkb];
	}),
	new ChargeData(["Silver Bow (No Charge)", "Silver Bow (No Charge, Aerial)"], 1, 60, function (base_damage, bkb, frames) {
		return [4.2 + (frames * 0.1125), bkb];
	}),
	new ChargeData(["Flare Blade (Uncharged)"], 0, 239, function (base_damage, bkb, frames) {
		return [6 + (frames * 5 / 30), bkb];
	}),
	new ChargeData(["Shield Breaker (No Charge)"], 0, 59, function (base_damage, bkb, frames) {
		return [base_damage * ((60 - frames) / 60 + (frames * 2.2 / 60)), bkb];
	}),
	new ChargeData(["Eruption"], 0, 119, function (base_damage, bkb, frames) {
		return [10 + (frames * 4 / 30), bkb];
	}),
	new ChargeData(["Quickdraw (Attack)"], 0, 70, function (base_damage, bkb, frames) {
		return [base_damage + (frames * 0.1), bkb];
	}),
	new ChargeData(["Giant Punch (Uncharged"], 0, 9, function (base_damage, bkb, frames) {
		if (frames == 1) {
			frames = 0;
		}
		return [base_damage + (2 * (frames - 1)), bkb];
	}),
	new ChargeData(["Charge Shot"], 0, 115, function (base_damage, bkb, frames) {
		return [base_damage + (frames / 116 * 22), bkb];
	}),
	new ChargeData(["Hero's Bow (No Charge)"], 0, 60, function (base_damage, bkb, frames) {
		return [4 + (12 - 4) * (frames / 60), bkb];
	}),
	new ChargeData(["Spin Attack (No Charge,"], 0, 60, function (base_damage, bkb, frames) {
		return [base_damage * ((60 - frames) / 60 + (frames * 1.6 / 60)), bkb];
	}),
	new ChargeData(["PK Flash (No Charge)", "PK Trash (No Charge)"], 0, 105, function (base_damage, bkb, frames) {
		return [5 + (((frames + 15) / 120) * .32 * 100), bkb];
	}),
	new ChargeData(["Dragon Fang Shot (Bite, No Charge)"], 0, 30, function (base_damage, bkb, frames) {
		return [base_damage + (7.7 * (frames / 30)), bkb];
	}),
	new ChargeData(["Dragon Fang Shot (Shot, No Charge)"], 0, 28, function (base_damage, bkb, frames) {
		return [base_damage * (1 + (1.25 * (frames / 30))), bkb + (frames * 0.65)]; //Still working on this formula
	})];

class Move {
	constructor(api_id, hitbox_no, name, moveName, base_damage, angle, bkb, kbg, wbkb, hitboxActive, faf, landingLag, autoCancel, preDamage, counterMult, rehitRate, shieldDamage) {
		this.api_id = api_id;
		this.id = 0;
		this.hitbox_no = hitbox_no;
		this.name = name;
		this.moveName = moveName;
		this.base_damage = base_damage;
		this.angle = angle;
		this.bkb = bkb;
		this.kbg = kbg;
		this.wbkb = wbkb;
		this.hitboxActive = hitboxActive;
		this.faf = faf;
		this.landingLag = landingLag;
		this.autoCancel = autoCancel;
		this.preLaunchDamage = preDamage;
		this.counterMult = counterMult;
		this.rehitRate = rehitRate;
		this.shieldDamage = shieldDamage;

		this.eval_autoCancel = function (value) {
			for (var i = 0; i < this.autoCancel.length; i++) {
				if (this.autoCancel[i].eval(value)) {
					return true;
				}
			}
			return false;
		}

		this.compareById = function (other) {
			if (this.api_id < other.api_id) {
				return -1;
			}
			if (this.api_id > other.api_id) {
				return 1;
			}
			if (this.hitbox_no < other.hitbox_no) {
				return -1;
			}
			if (this.hitbox_no > other.hitbox_no) {
				return 1;
			}
			return 0;
		}

		this.valid = true;
		this.smash_attack = name.includes("Fsmash") || name.includes("Usmash") || name.includes("Dsmash");
		this.throw = name.includes("Fthrow") || name.includes("Bthrow") || name.includes("Uthrow") || name.includes("Dthrow");
		this.chargeable = name.includes("No Charge") || name.includes("Uncharged") || (name.includes("Eruption") && !name.includes("Fully Charged")) || name == "Charge Shot" || name == "Quickdraw (Attack)";
		this.grab = this.name == "Standing Grab" || this.name == "Dash Grab" || this.name == "Pivot Grab";
		this.tilt = this.name.includes("Utilt") || this.name.includes("Ftilt") || this.name.includes("Dtilt");
		this.jab = this.name.includes("Jab");
		this.aerial = this.name.includes("Uair") || this.name.includes("Fair") || this.name.includes("Bair") || this.name.includes("Dair") || this.name.includes("Nair") || this.name.includes("Zair");
		this.taunt = this.name.includes("Taunt");
		this.dashAttack = this.name.includes("Dash Attack");
		this.counter = this.counterMult != 0 || this.name.includes("Counter (Attack)") || this.name.includes("Substitute (Attack") || this.name.includes("Toad (Attack") || this.name.includes("Witch Time");
		this.commandGrab = !this.grab && (this.name.includes("Grab") || this.name.includes("Confusion") || (this.name.includes("Inhale") && !this.name.includes("Spit")) || (this.name.includes("Chomp") && !this.name.includes("Food") && !this.name.includes("Eating")) || this.name.includes("Egg Lay") || this.name.includes("Flame Choke")) && !this.name.includes("Attack") && !this.name.includes("(Hitbox)");
		this.unblockable = this.grab || this.throw || this.commandGrab || (this.name.includes("Vision") && this.name.includes("Attack")) || this.name.includes("Witch Time") || this.name.includes("KO Punch") || this.name == "Focus Attack (Stage 3)" || this.name == "Reflect Barrier";
		this.windbox = this.name.includes("Windbox") || this.name.includes("Flinchless") || this.name == "Hydro Pump" || this.name == "F.L.U.D.D (Attack)";
		this.multihit = /(Hit [0-9]+)/gi.test(this.name) || /(Hits [0-9]+\-[0-9]+)/gi.test(this.name) || this.name.includes("Final Hit") || this.rehitRate != 0;
		this.spike = this.angle >= 230 && this.angle <= 310;

		this.charge = null;
		if (this.chargeable) {
			this.charge = ChargeData.get(chargeMoves, this.name);
			this.charge_damage = function (frames) {
				return +this.charge.formula(this.base_damage, this.bkb, frames)[0].toFixed(4);
			}
			this.charge_bkb = function (frames) {
				return +this.charge.formula(this.base_damage, this.bkb, frames)[1].toFixed(4);
			}
		}

		this.invalidate = function () {
			this.valid = false;
			return this;
		}

		this.addCharacter = function (character) {
			this.character = character;
			return this;
		}

		this.type = this.smash_attack ? "Smash" :
			this.throw ? "Throw" :
				this.grab ? "Grab" :
					this.tilt ? "Tilt" :
						this.jab ? "Jab" :
							this.aerial ? "Aerial" :
								this.taunt ? "Taunt" :
									this.dashAttack ? "DashAttack" :
										"Special";

		if (this.counter) {
			this.type += ",Counter";
		}

		if (this.commandGrab) {
			this.type += ",CommandGrab";
		}

		if (this.unblockable && !this.throw && !this.grab && !this.commandGrab) {
			this.type += ",Unblockable";
		}

		if (this.windbox) {
			this.type += ",Windbox";
		}

		if (this.multihit) {
			this.type += ",Multihit";
		}

		if (this.shieldDamage != 0) {
			this.type += ",ExtraShieldDamage";
		}

		if (this.spike) {
			this.type += ",Spike";
		}

		if (this.name.includes("True")) {
			this.type += ",RyuTrue";
		}

		if ((this.name.includes("Limit") && !this.name.includes("Limit Break")) || this.name.includes("Finishing Touch")) {
			this.type += ",LimitBreak";
		}

		if (previousMove != null && this.hitboxActive.length == 1 && isNaN(this.faf)) {
			if (this.moveName.split("(")[0].trim() == previousMove.moveName.split("(")[0].trim()) {
				this.faf = previousMove.faf;
				if (this.autoCancel.length == 1) {
					if (this.autoCancel[0].type == "empty") {
						this.autoCancel = previousMove.autoCancel;
					}
				}
				if (this.landingLag == "-" || isNaN(this.landingLag)) {
					this.landingLag = previousMove.landingLag;
				}
			}
		}
		previousMove = this;
	}
};

function getCharacterIdFromKH(name) {
	
	var api_name = name.toLowerCase().replace("&", "").replace("and", "").replace("-", "").split(".").join("").split(" ").join("");
	
	var json = require("../Data/characters");

	for (var i = 0; i < json.length; i++) {
		if (api_name == json[i].name.toLowerCase()) {
			return json[i].id;
		}
	}

	return -1;
}

var names = ["Mario", "Luigi", "Peach", "Bowser", "Yoshi", "Rosalina & Luma", "Bowser Jr.", "Wario", "Donkey Kong", "Diddy Kong", "Mr. Game & Watch", "Little Mac", "Link", "Zelda", "Sheik", "Ganondorf", "Toon Link", "Samus", "Zero Suit Samus", "Pit", "Palutena", "Marth", "Ike", "Robin", "Duck Hunt", "Kirby", "King Dedede", "Meta Knight", "Fox", "Falco", "Pikachu", "Charizard", "Lucario", "Jigglypuff", "Greninja", "R.O.B", "Ness", "Captain Falcon", "Villager", "Olimar", "Wii Fit Trainer", "Shulk", "Dr. Mario", "Dark Pit", "Lucina", "PAC-MAN", "Mega Man", "Sonic", "Mewtwo", "Lucas", "Roy", "Ryu", "Cloud", "Corrin", "Bayonetta", "Mii Swordfighter", "Mii Brawler", "Mii Gunner"];
var KHcharacters = ["Mario", "Luigi", "Peach", "Bowser", "Yoshi", "Rosalina And Luma", "Bowser Jr", "Wario", "Donkey Kong", "Diddy Kong", "Mr. Game & Watch", "Little Mac", "Link", "Zelda", "Sheik", "Ganondorf", "Toon Link", "Samus", "Zero Suit Samus", "Pit", "Palutena", "Marth", "Ike", "Robin", "Duck Hunt", "Kirby", "King Dedede", "Meta Knight", "Fox", "Falco", "Pikachu", "Charizard", "Lucario", "Jigglypuff", "Greninja", "R.O.B", "Ness", "Captain Falcon", "Villager", "Olimar", "Wii Fit Trainer", "Shulk", "Dr. Mario", "Dark Pit", "Lucina", "PAC-MAN", "Mega Man", "Sonic", "Mewtwo", "Lucas", "Roy", "Ryu", "Cloud", "Corrin", "Bayonetta", "Mii Swordfighter", "Mii Brawler", "Mii Gunner"];

function getCharacterNameFromId(id) {
	var json = require("../Data/characters");

	var api_name = null;

	for (var i = 0; i < json.length; i++) {
		if (id == json[i].id) {
			api_name = json[i].name.toLowerCase();
			break;
		}

	}

	if (api_name != null) {
		for (var i = 0; i < KHcharacters.length; i++) {
			if (KHcharacters[i].toLowerCase().replace("&","").replace("and", "").replace("-", "").split(".").join("").split(" ").join("") == api_name) {
				return names[i];
			}
		}
	}

	return null;
}

function getMoveset(name, callback) {
	var id = getCharacterIdFromKH(name);
	if (id == -1) {
		callback(null);
	}
	var http = require('http');
	var options = {
		host: 'api.kuroganehammer.com',
		path: '/api/Characters/' + id + "/moves",
		method: 'GET'
	};

	var moves = null;

	var req = http.request(options, function (res) {
		var json = "";
		res.setEncoding('utf8');
		res.on('data', function (data) {
			json += data;
		});
		res.on('end', function () {
			try {
				var moveset = JSON.parse(json);
				moves = [];
				var count = 1;
				for (var i = 0; i < moveset.length; i++) {
					var move = moveset[i];
					var parser = new MoveParser(move.id, move.name, move.baseDamage, move.angle, move.baseKnockBackSetKnockback, move.knockbackGrowth, move.hitboxActive, move.firstActionableFrame, move.landingLag, move.autoCancel, false);
					for (var c = 0; c < parser.moves.length; c++) {
						var m = parser.moves[c];
						m.id = count;
						if (!m.grab && m.valid) {
							delete m.valid;
							moves.push(m);
							count++;
						}
					}
				}

				callback(moves);

			} catch (e) {
				moves = null;
				callback(moves);
			}
		});
	}).on('error', function (err) {
		moves = null;
		callback(moves);
		});

	req.end();
}

function getMove(id, callback) {
	var http = require('http');
	var options = {
		host: 'api.kuroganehammer.com',
		path: '/api/moves/' + id,
		method: 'GET'
	};

	var moves = null;

	var req = http.request(options, function (res) {
		var json = "";
		res.setEncoding('utf8');
		res.on('data', function (data) {
			json += data;
		});
		res.on('end', function () {
			try {
				var move = JSON.parse(json);
				moves = [];
				var count = 1;
				var parser = new MoveParser(move.id, move.name, move.baseDamage, move.angle, move.baseKnockBackSetKnockback, move.knockbackGrowth, move.hitboxActive, move.firstActionableFrame, move.landingLag, move.autoCancel, false);
				for (var c = 0; c < parser.moves.length; c++) {
					var m = parser.moves[c];
					m.id = count;
					if (!m.grab && m.valid) {
						delete m.valid;
						moves.push(m);
						count++;
					}
				}
				callback(moves);

			} catch (e) {
				moves = null;
				callback(moves);
			}
		});
	}).on('error', function (err) {
		moves = null;
		callback(moves);
	});

	req.end();
}

class Throw {
	constructor(id, move_id, weightDependent) {
		this.id = id;
		this.move_id = move_id;
		this.weightDependent = weightDependent;
	}
};

exports.Move = Move;
exports.Throw = Throw;

exports.getCharacterIdFromKH = getCharacterIdFromKH;
exports.getCharacterNameFromId = getCharacterNameFromId;
exports.names = names;
exports.KHcharacters = KHcharacters;
exports.getMoveset = getMoveset;
exports.getMove = getMove;