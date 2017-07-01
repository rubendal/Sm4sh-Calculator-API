var fs = require('fs');
var kh = require('./khapi');

function loadJSON(file) {
	return require(file.replace(".json", ""));
}

var parameters = {
	di: 0.17,
	lsi_max: 1.095,
	lsi_min: 0.92,
	decay: 0.051,
	gravity: {
		mult: 5,
		constant: 0.075
	},
	bounce: 0.8,
	crouch_cancelling: 0.85,
	crouch_hitlag: 0.67,
	interrupted_smash: 1.2,
	hitstun: 0.4,
	launch_speed: 0.03,
	tumble_threshold: 32,
	hitlag: {
		mult: 0.3846154,
		constant: 5
	},
	hitstunCancel: {
		frames: {
			aerial: 45,
			airdodge: 40
		},
		launchSpeed: {
			aerial: 2,
			airdodge: 2.5
		}
	},
	paralyzer: {
		constant: 14,
		mult: 0.025
	}
};

//Formulas
function TrainingKB(percent, base_damage, damage, weight, kbg, bkb, gravity, fall_speed, r, angle, in_air, windbox, electric, di, launch_rate) {
	return new Knockback((((((((percent + damage) / 10) + (((percent + damage) * base_damage) / 20)) * (200 / (weight + 100)) * 1.4) + 18) * (kbg / 100)) + bkb) * r, angle, gravity, fall_speed, in_air, windbox, electric, percent + damage, di, 1);
}

function Rage(percent) {
	if (percent <= 35) {
		return 1;
	}
	if (percent >= 150) {
		return 1.15;
	}
	return 1 + (percent - 35) * (1.15 - 1) / (150 - 35);
}

function Aura(percent, stock_dif, game_format) {
	if (typeof stock_dif == "undefined") {
		stock_dif = "0";
	}
	if (typeof game_format == "undefined") {
		game_format = "Singles";
	}
	var aura = 0;
	if (percent <= 70) {
		aura = (66 + ((17.0 / 35.0) * percent)) / 100;
	} else if (percent <= 190) {
		aura = (100 + ((7.0 / 12.0) * (percent - 70))) / 100;
	} else {
		aura = 1.7;
	}
	//Stock difference data by KuroganeHammer, @A2E_smash and @Rmenaut, https://twitter.com/KuroganeHammer/status/784017200721965057
	//For Doubles https://twitter.com/KuroganeHammer/status/784372918331383808
	var m = 1;
	var min = 0.6;
	var max = 1.7;
	if (stock_dif == "0") {
		return aura;
	}
	if (game_format == "Singles") {
		switch (stock_dif) {
			case "-2":
				m = 1.3333;
				min = 0.88;
				max = 1.8;
				break;
			case "-1":
				m = 1.142;
				min = 0.753;
				max = 1.8;
				break;
			case "+1":
				m = 0.8888;
				max = 1.51;
				break;
			case "+2":
				m = 0.8;
				max = 1.36;
				break;
		}
	} else {
		switch (stock_dif) {
			case "-2":
				m = 2;
				min = 1.32;
				max = 1.8;
				break;
			case "-1":
				m = 1.3333;
				min = 0.88;
				max = 1.8;
				break;
			case "+1":
				m = 0.8;
				max = 1.36;
				break;
			case "+2":
				m = 0.6333;
				max = 1.076;
				break;
		}
	}
	aura *= m;
	if (aura < min) {
		aura = min;
	} else if (aura > max) {
		aura = max;
	}
	return aura;
}

function StaleNegation(queue, ignoreStale) {
	if (ignoreStale) {
		return 1;
	}
	//if (timesInQueue > 9) {
	//    timesInQueue = 9;
	//}
	//if (timesInQueue == 0) {
	//    return 1.05;
	//}
	var S = [0.08, 0.07594, 0.06782, 0.06028, 0.05274, 0.04462, 0.03766, 0.02954, 0.022];
	var s = 1;
	for (var i = 0; i < queue.length; i++) {
		if (queue[i]) {
			s -= S[i];
		}
	}
	if (s == 1) {
		return 1.05;
	}
	return s;
}

function ElectricMove(value) {
	switch (value) {
		case "electric":
			return true;
		case "none":
			return false;
	}
	return false;
}

function Hitstun(kb, windbox, electric, ignoreReeling) {
	if (windbox) {
		return 0;
	}
	var hitstun = Math.floor(kb * parameters.hitstun) - 1;
	if (!ignoreReeling) {
		if (kb * parameters.hitstun >= parameters.tumble_threshold) {
			hitstun++;
		}
	}
	//Electric moves deal +1 hitstun https://twitter.com/Meshima_/status/786780420817899521
	if (ElectricMove(electric)) {
		hitstun++;
	}
	if (hitstun < 0) {
		return 0;
	}
	return hitstun;
}

function SakuraiAngle(kb, aerial) {
	if (aerial) {
		return (.79 * 180 / Math.PI);
	}
	if (kb < 60) {
		return 0;
	}
	if (kb >= 88) {
		return 40;
	}
	if (kb == 60) {
		return (kb - 59.9999) / 0.7
	}
	return (kb - 60) / 0.7;
}

function VSKB(percent, base_damage, damage, weight, kbg, bkb, gravity, fall_speed, r, timesInQueue, ignoreStale, attacker_percent, angle, in_air, windbox, electric, di, launch_rate) {
	var s = StaleNegation(timesInQueue, ignoreStale);
	return new Knockback((((((((percent + damage * s) / 10 + (((percent + damage * s) * base_damage * (1 - (1 - s) * 0.3)) / 20)) * 1.4 * (200 / (weight + 100))) + 18) * (kbg / 100)) + bkb)) * (r * Rage(attacker_percent)), angle, gravity, fall_speed, in_air, windbox, electric, percent + (damage * s), di, launch_rate);
}

function WeightBasedKB(weight, bkb, wbkb, kbg, gravity, fall_speed, r, target_percent, damage, attacker_percent, angle, in_air, windbox, electric, di, launch_rate) {
	return new Knockback((((((1 + (wbkb / 2)) * (200 / (weight + 100)) * 1.4) + 18) * (kbg / 100)) + bkb) * (r * Rage(attacker_percent)), angle, gravity, fall_speed, in_air, windbox, electric, target_percent + damage, di, launch_rate);
}

function StaleDamage(base_damage, timesInQueue, ignoreStale) {
	return base_damage * StaleNegation(timesInQueue, ignoreStale);
}

function FirstActionableFrame(kb, windbox, electric, ignoreReeling) {
	var hitstun = Hitstun(kb, windbox, electric, ignoreReeling);
	if (hitstun == 0) {
		return 0;
	}
	return hitstun + 1;
}

function HitstunCancel(kb, launch_speed_x, launch_speed_y, angle, windbox, electric) {
	var res = { 'airdodge': 0, 'aerial': 0 };
	if (windbox) {
		return res;
	}
	var hitstun = Hitstun(kb, windbox, electric);
	var res = { 'airdodge': hitstun + 1, 'aerial': hitstun + 1 };
	var airdodge = false;
	var aerial = false;
	var launch_speed = { 'x': launch_speed_x, 'y': launch_speed_y };
	var decay = { 'x': parameters.decay * Math.cos(angle * Math.PI / 180), 'y': parameters.decay * Math.sin(angle * Math.PI / 180) };
	var ec = ElectricMove(electric) ? 1 : 0;
	for (var i = 0; i < hitstun; i++) {
		if (launch_speed.x != 0) {
			var x_dir = launch_speed.x / Math.abs(launch_speed.x);
			launch_speed.x -= decay.x;
			if (x_dir == -1 && launch_speed.x > 0) {
				launch_speed.x = 0;
			} else if (x_dir == 1 && launch_speed.x < 0) {
				launch_speed.x = 0;
			}
		}
		if (launch_speed.y != 0) {
			var y_dir = launch_speed.y / Math.abs(launch_speed.y);
			launch_speed.y -= decay.y;
			if (y_dir == -1 && launch_speed.y > 0) {
				launch_speed.y = 0;
			} else if (y_dir == 1 && launch_speed.y < 0) {
				launch_speed.y = 0;
			}
		}
		var lc = Math.sqrt(Math.pow(launch_speed.x, 2) + Math.pow(launch_speed.y, 2));
		if (lc < parameters.hitstunCancel.launchSpeed.airdodge && !airdodge) {
			airdodge = true;
			res.airdodge = Math.max(i + 2, parameters.hitstunCancel.frames.airdodge + 1 + ec);
		}
		if (lc < parameters.hitstunCancel.launchSpeed.aerial && !aerial) {
			aerial = true;
			res.aerial = Math.max(i + 2, parameters.hitstunCancel.frames.aerial + 1 + ec);
		}
	}

	if (res.airdodge > hitstun) {
		res.airdodge = hitstun + 1;
	}
	if (res.aerial > hitstun) {
		res.aerial = hitstun + 1;
	}

	return res;
}

function Hitlag(base_damage, hitlag_mult, electric, crouch) {
	var h = Math.floor((((base_damage * parameters.hitlag.mult + parameters.hitlag.constant) * electric) * hitlag_mult) * crouch) - 1;
	if (h > 30) {
		return 30;
	}
	if (h < 0) {
		return 0;
	}
	return h;
}

function ParalyzerHitlag(base_damage, hitlag_mult, crouch) {
	var h = Math.floor(((base_damage * parameters.hitlag.mult + parameters.paralyzer.constant)) * hitlag_mult * crouch * parameters.paralyzer.mult);
	if (h < 0) {
		return 0;
	}
	return h;
}

function ParalysisTime(kb, base_damage, hitlag_mult, crouch) {
	var p = Math.floor((((base_damage * parameters.hitlag.mult + parameters.paralyzer.constant)) * hitlag_mult) * crouch * parameters.paralyzer.mult * kb);
	if (p > 76) {
		return 76;
	}
	if (p < 0) {
		return 0;
	}
	return p;
}

function ChargeSmash(base_damage, frames, megaman_fsmash, witch_time) {
	if (megaman_fsmash) {
		return base_damage * (1 + (frames / 86));
	}
	if (witch_time) {
		return base_damage * (1 + (frames * 0.5 / 150));
	}
	return base_damage * (1 + (frames / 150));
}

function ChargeSmashMultiplier(frames, megaman_fsmash, witch_time) {
	if (megaman_fsmash) {
		return (1 + (frames / 86));
	}
	if (witch_time) {
		return (1 + (frames * 0.5 / 150));
	}
	return (1 + (frames / 150));
}

function ShieldStun(damage, is_projectile, powershield) {
	if (is_projectile) {
		if (powershield) {
			return Math.floor((damage / 5.22) + 3) - 1;
		}
		return Math.floor((damage / 3.5) + 3) - 1;
	} else {
		if (powershield) {
			return Math.floor((damage / 2.61) + 3) - 1;
		}
		return Math.floor((damage / 1.72) + 3) - 1;
	}
}

function ShieldHitlag(damage, hitlag, electric) {
	return Hitlag(damage, hitlag, electric, 1);
}

function AttackerShieldHitlag(damage, hitlag, electric) {
	return ShieldHitlag(damage, hitlag, electric);
}

function ShieldAdvantage(damage, hitlag, hitframe, FAF, is_projectile, electric, powershield) {
	return hitframe - (FAF - 1) + ShieldStun(damage, is_projectile, powershield) + ShieldHitlag(damage, hitlag, electric) - (is_projectile ? 0 : AttackerShieldHitlag(damage, hitlag, electric));
}

function DI(angle, move_angle) {
	if (angle == -1) {
		return 0;
	}
	//Value was 10, however in params is 0.17 in radians, https://twitter.com/Meshima_/status/766640794807603200
	return (parameters.di * 180 / Math.PI) * Math.sin((angle - move_angle) * Math.PI / 180);
}

function LSI(angle, launch_angle) {
	if (angle == -1) {
		return 1;
	}
	if (launch_angle > 65 && launch_angle < 115) {
		return 1;
	}
	if (launch_angle > 245 && launch_angle < 295) {
		return 1;
	}
	if (angle >= 0 && angle <= 180) {
		return 1 + ((parameters.lsi_max - 1) * Math.sin(angle * Math.PI / 180));
	}
	return 1 + ((1 - parameters.lsi_min) * Math.sin(angle * Math.PI / 180));

}

function LaunchSpeed(kb) {
	return kb * parameters.launch_speed;
}

function HitAdvantage(hitstun, hitframe, faf) {
	return hitstun - (faf - (hitframe + 1));
}

//Launch visualizer formulas

function InvertXAngle(angle) {
	if (angle < 180) {
		return 180 - angle;
	} else {
		return 360 - (angle - 180);
	}
}

function InvertYAngle(angle) {
	if (angle < 180) {
		return (180 - angle) + 180;
	} else {
		return 180 - (angle - 180);
	}
}

//Get the distance between a point and a line
function LineDistance(point, line) {
	return Math.abs(((line[1][1] - line[0][1]) * point[0]) - ((line[1][0] - line[0][0]) * point[1]) + (line[1][0] * line[0][1]) - (line[1][1] * line[0][0])) / Math.sqrt(Math.pow(line[1][1] - line[0][1], 2) + Math.pow(line[1][0] - line[0][0], 2));
}

//Get the closest line from a point
function closestLine(point, surface) {
	var x = point[0];
	var y = point[1];

	var line = { i: -1, line: [] };
	var min_distance = null;

	for (var i = 0; i < surface.length - 1; i++) {
		var x1 = surface[i][0];
		var x2 = surface[i + 1][0];
		var y1 = surface[i][1];
		var y2 = surface[i + 1][1];
		var distance = Math.abs(((y2 - y1) * x) - ((x2 - x1) * y) + (x2 * y1) - (y2 * x1)) / Math.sqrt(Math.pow(y2 - y1, 2) + Math.pow(x2 - x1, 2));
		if (min_distance == null) {
			line.i = i;
			min_distance = distance;
			line.line = [[x1, y1], [x2, y2]];
		} else {
			if (distance < min_distance) {
				min_distance = distance;
				line.i = i;
				line.line = [[x1, y1], [x2, y2]];
			}
		}
	}
	return line;
}

var LineTypes = {
	FLOOR: 1,
	WALL: 2,
	CEILING: 3
};

//Get if line is floor, wall or ceiling
function GetLineType(material) {

	if (!material.ceiling && !material.wall) {
		return LineTypes.FLOOR;
	}
	if (material.wall) {
		return LineTypes.WALL;
	}
	return LineTypes.CEILING;
}

//Find the point where two lines intersect when they expand through infinity
function IntersectionPoint(line_a, line_b) {
	var x1 = line_a[0][0];
	var x2 = line_a[1][0];
	var y1 = line_a[0][1];
	var y2 = line_a[1][1];
	var x3 = line_b[0][0];
	var x4 = line_b[1][0];
	var y3 = line_b[0][1];
	var y4 = line_b[1][1];
	var d = ((x1 - x2) * (y3 - y4)) - ((y1 - y2) * (x3 - x4));
	var x = (((x1 * y2) - (y1 * x2)) * (x3 - x4)) - ((x1 - x2) * ((x3 * y4) - (y3 * x4)));
	var y = (((x1 * y2) - (y1 * x2)) * (y3 - y4)) - ((y1 - y2) * ((x3 * y4) - (y3 * x4)));
	if (d != 0) {
		var xd = x / d;
		var yd = y / d;
		if (xd == -0)
			xd = 0;
		if (yd == -0)
			yd = 0;
		return [+xd.toFixed(6), +yd.toFixed(6)];
	}
	return null;
}

//Get if a point is on a line segment given by two points
function PointInLine(point, line) {
	var x = point[0];
	var y = point[1];
	var x1 = line[0][0];
	var x2 = line[1][0];
	var y1 = line[0][1];
	var y2 = line[1][1];

	var hx = Math.max(x1, x2);
	var lx = Math.min(x1, x2);
	var hy = Math.max(y1, y2);
	var ly = Math.min(y1, y2);

	var distance = Math.abs(((y2 - y1) * x) - ((x2 - x1) * y) + (x2 * y1) - (y2 * x1)) / Math.sqrt(Math.pow(y2 - y1, 2) + Math.pow(x2 - x1, 2));
	if (distance < 0.001) {
		//lx,ly - 0.001, hx,hy + 0.001 for precision loss cases
		return (lx - 0.001) <= x && x <= (hx + 0.001) && (ly - 0.001) <= y && y <= (hy + 0.001);
	}
	return false;
}

function GetPointFromSlide(point, speed, angle, line) {
	var x = point[0] + (Math.abs(speed.x) * Math.cos(angle * Math.PI / 180));
	var y = point[1] + (Math.abs(speed.y) * Math.sin(angle * Math.PI / 180));
	return [x, y];

}

//Used in sliding, to prevent float precision errors or random js stuff get the closest point of a line near to another point
function ClosestPointToLine(point, line) {
	var a = line[0];
	var b = line[1];

	var ap = [point[0] - a[0], point[1] - a[1]];
	var ab = [b[0] - a[0], b[1] - a[1]];

	var p = (ap[0] * ab[0]) + (ap[1] * ab[1]);
	var m = (Math.pow(ab[0], 2) + Math.pow(ab[1], 2));

	var distance = p / m;

	if (distance == -0) {
		distance = 0;
	}

	return [a[0] + (ab[0] * distance), a[1] + (ab[1] * distance)];

	//if (distance < 0)
	//	return a;
	//else if (distance > 1)
	//	return b;
	//else
	//	return [a[0] + (ab[0] * distance), a[1] + (ab[1] * distance)];
}

//Check if launch angle goes to the opposite direction of the line normal vector angle, returns false when the line is on the same direction or parallel
function LineCollision(launch_angle, line_angle) {
	var a = Math.cos(Math.abs(line_angle - launch_angle) * Math.PI / 180);
	if (a > 0) {
		return false;
	}
	return true;
}

//Get all lines that intersect with a line
function IntersectionLines(line, vertex) {
	var l = [];

	for (var i = 0; i < vertex.length - 1; i++) {
		var stageLine = [vertex[i], vertex[i + 1]];
		var p = IntersectionPoint(line, stageLine);
		if (p != null) {
			var f = PointInLine(p, line) && PointInLine(p, stageLine);
			if (f) {
				l.push({ "i": i, "point": p, "line": stageLine });
			}
		}
	}

	return l;
}

//Get line angle given by two points
function LineAngle(line) {
	return ((Math.atan2(line[1][1] - line[0][1], line[1][0] - line[0][0]) * 180 / Math.PI) + 360) % 360;
}


var characters = ["Mario", "Luigi", "Peach", "Bowser", "Yoshi", "Rosalina And Luma", "Bowser Jr", "Wario", "Donkey Kong", "Diddy Kong", "Game And Watch", "Little Mac", "Link", "Zelda", "Sheik", "Ganondorf", "Toon Link", "Samus", "Zero Suit Samus", "Pit", "Palutena", "Marth", "Ike", "Robin", "Duck Hunt", "Kirby", "King Dedede", "Meta Knight", "Fox", "Falco", "Pikachu", "Charizard", "Lucario", "Jigglypuff", "Greninja", "R.O.B", "Ness", "Captain Falcon", "Villager", "Olimar", "Wii Fit Trainer", "Shulk", "Dr. Mario", "Dark Pit", "Lucina", "PAC-MAN", "Mega Man", "Sonic", "Mewtwo", "Lucas", "Roy", "Ryu", "Cloud", "Corrin", "Bayonetta", "Mii Swordfighter", "Mii Brawler", "Mii Gunner"];
//April Fools
//var names = ["Not top 5", "Green Mario", "UpB with 180 WBKB", "Uthrow-Uair", "Egg shield", "Luma", "Clown Kart", "Wah", "Expand", "Banana-Dtilt-Usmash", "Mr. Bucket & 9", "Good frame data/horrible aerials", "Lonk", "Link?", "Can't kill past 130%", "DISRESPECT", "Bomb-Fair", "Spamus", "Zero Skill Samus", "Hot spring maniac", "Top tier with customs", "Morth", "Slow Marth", "Magical Marth", "Dog & Duck", "Hi!", "Sakurai's voice", "Not Brawl", "Honest", "Revali", "Quick Attack", "Orange flying lizard", "Aura is Broken", "Never buffed", "Nerfed", "Beep Boop", "Okay", "Dthrow to knee is not true", "Killager", "Pikmin", "Feel the burn", "Commentator's nightmare", "Doc is In", "Edgy Pit", "Female Marth", "Useless grab", "Lemons", "Sanic", "Heavier than Charizard in Pokemon", "Zair/PK Fire spacing", "Boy Marth", "Utilt", "Genkai wo Koeru", "Instapin", "BANonetta", "Nonexistant Swordfighter", "Nonexistant Brawler", "Nonexistant Gunner"];
var names = ["Mario", "Luigi", "Peach", "Bowser", "Yoshi", "Rosalina & Luma", "Bowser Jr.", "Wario", "Donkey Kong", "Diddy Kong", "Mr. Game & Watch", "Little Mac", "Link", "Zelda", "Sheik", "Ganondorf", "Toon Link", "Samus", "Zero Suit Samus", "Pit", "Palutena", "Marth", "Ike", "Robin", "Duck Hunt", "Kirby", "King Dedede", "Meta Knight", "Fox", "Falco", "Pikachu", "Charizard", "Lucario", "Jigglypuff", "Greninja", "R.O.B", "Ness", "Captain Falcon", "Villager", "Olimar", "Wii Fit Trainer", "Shulk", "Dr. Mario", "Dark Pit", "Lucina", "PAC-MAN", "Mega Man", "Sonic", "Mewtwo", "Lucas", "Roy", "Ryu", "Cloud", "Corrin", "Bayonetta", "Mii Swordfighter", "Mii Brawler", "Mii Gunner"];
var KHcharacters = ["Mario", "Luigi", "Peach", "Bowser", "Yoshi", "Rosalina And Luma", "Bowser Jr", "Wario", "Donkey Kong", "Diddy Kong", "Mr. Game & Watch", "Little Mac", "Link", "Zelda", "Sheik", "Ganondorf", "Toon Link", "Samus", "Zero Suit Samus", "Pit", "Palutena", "Marth", "Ike", "Robin", "Duck Hunt", "Kirby", "King Dedede", "Meta Knight", "Fox", "Falco", "Pikachu", "Charizard", "Lucario", "Jigglypuff", "Greninja", "R.O.B", "Ness", "Captain Falcon", "Villager", "Olimar", "Wii Fit Trainer", "Shulk", "Dr. Mario", "Dark Pit", "Lucina", "PAC-MAN", "Mega Man", "Sonic", "Mewtwo", "Lucas", "Roy", "Ryu", "Cloud", "Corrin", "Bayonetta", "Mii Swordfighter", "Mii Brawler", "Mii Gunner"];
var gameNames = ["mario", "luigi", "peach", "koopa", "yoshi", "rosetta", "koopajr", "wario", "donkey", "diddy", "gamewatch", "littlemac", "link", "zelda", "sheik", "ganon", "toonlink", "samus", "szerosuit", "pit", "palutena", "marth", "ike", "reflet", "duckhunt", "kirby", "dedede", "metaknight", "fox", "falco", "pikachu", "lizardon", "lucario", "purin", "gekkouga", "robot", "ness", "captain", "murabito", "pikmin", "wiifit", "shulk", "drmario", "pitb", "lucina", "pacman", "rockman", "sonic", "mewtwo", "lucas", "roy", "ryu", "cloud", "kamui", "bayonetta", "miiswordsman", "miifighter", "miigunner"];

class Modifier {
	constructor(name, damage_dealt, damage_taken, kb_dealt, kb_received, gravity, fall_speed, shield, air_friction, traction) {
		this.name = name;
		this.damage_dealt = damage_dealt;
		this.damage_taken = damage_taken;
		this.kb_dealt = kb_dealt;
		this.kb_received = kb_received;
		this.gravity = gravity;
		this.fall_speed = fall_speed;
		this.shield = shield;
		this.air_friction = air_friction;
		this.traction = traction;
	}
};

var monado = [
	new Modifier("Jump", 1, 1.22, 1, 1, 1.3, 1.22, 1, 1, 1),
	new Modifier("Speed", 0.8, 1, 1, 1, 1, 1, 1, 1, 1.5),
	new Modifier("Shield", 0.7, 0.67, 1, .78, 1, 1, 1.5, 1, 1),
	new Modifier("Buster", 1.4, 1.13, 0.68, 1, 1, 1, 1, 1, 1),
	new Modifier("Smash", 0.5, 1, 1.18, 1.07, 1, 1, 1, 1, 1)
];

var decisive_monado = [
	new Modifier("Decisive Jump", 1, 1.22, 1, 1, 1.43, 1.342, 1, 1, 1),
	new Modifier("Decisive Speed", 0.8, 1, 1, 1, 1.1, 1, 1, 1, 1.65),
	new Modifier("Decisive Shield", .7, 0.603, 1, .702, 1, 1, 1.5 * 1.1, 1, 1),
	new Modifier("Decisive Buster", 1.4 * 1.1, 1.13, 0.68, 1, 1, 1, 1, 1, 1),
	new Modifier("Decisive Smash", 0.5, 1, 1.18 * 1.1, 1.07, 1, 1, 1, 1, 1)
];

var hyper_monado = [
	new Modifier("Hyper Jump", 1, 1.22 * 1.2, 1, 1, 1.56, 1.464, 1, 1, 1),
	new Modifier("Hyper Speed", 0.64, 1, 1, 1, 1.2, 1, 1, 1, 1.8),
	new Modifier("Hyper Shield", 0.56, 0.536, 1, .624, 1, 1, 1.5 * 1.2, 1, 1),
	new Modifier("Hyper Buster", 1.4 * 1.2, 1.13 * 1.2, 0.544, 1, 1, 1, 1, 1, 1),
	new Modifier("Hyper Smash", 0.4, 1, 1.18 * 1.2, 1.07 * 1.2, 1, 1, 1, 1, 1)
];

class Character {
	constructor(n) {
		this.display_name = n;
		var name = characters[names.indexOf(n)];
		this.addModifier = function (modifier) {
			this.modifier = modifier;
		}
		this.modifier = new Modifier("Normal", 1, 1, 1, 1, 1, 1, 1, 1, 1);
		this.modifiers = [];
		if (this.name == null) {
			this.name = name;
		}
		if (this.name == "Shulk") {
			this.modifiers = [new Modifier("Normal", 1, 1, 1, 1, 1, 1, 1, 1, 1)];
			this.modifiers = this.modifiers.concat(monado);
			this.modifiers = this.modifiers.concat(decisive_monado);
			this.modifiers = this.modifiers.concat(hyper_monado);
		} else if (this.name == "Kirby") {
			this.modifiers = [new Modifier("Normal", 1, 1, 1, 1, 1, 1, 1, 1, 1)];
			this.modifiers = this.modifiers.concat(monado);
		} else if (this.name == "Bowser Jr") {
			this.modifiers = [new Modifier("Clown Kart", 1, 0.88, 1, 1, 1, 1, 1, 1, 1), new Modifier("Body", 1, 1.15, 1, 1, 1, 1, 1, 1, 1)];
			this.modifier = this.modifiers[0];
		} else if (this.name == "Wii Fit Trainer") {
			this.modifiers = [new Modifier("Normal", 1, 1, 1, 1, 1, 1, 1, 1, 1), new Modifier("Fast Deep Breathing", 1.2, 0.9, 1, 1, 1, 1, 1, 1, 1), new Modifier("Slow Deep Breathing", 1.16, 0.9, 1, 1, 1, 1, 1, 1, 1)];

		} else if (this.name == "Cloud") {
			this.modifiers = [new Modifier("Normal", 1, 1, 1, 1, 1, 1, 1, 1, 1), new Modifier("Limit Break", 1, 1, 1, 1, 1.1, 1.1, 1, 1.15, 1.15)];
		}

		this.getModifier = function (name) {
			if (this.modifiers.length == 0) {
				return new Modifier("Normal", 1, 1, 1, 1, 1, 1, 1, 1, 1);
			}
			for (var i = 0; i < this.modifiers.length; i++) {
				if (this.modifiers[i].name == name) {
					return this.modifiers[i];
				}
			}
			return null;
		}

		this.api_name = this.name;
		if (name == "Game And Watch") {
			this.api_name = "Mrgamewatch";
		}
		this.attributes = loadJSON("../Data/" + this.name + "/attributes.json");


	}

};

//Bit Flagged state
var CharacterState = {
	LAUNCH_START: 1, //Start launch
	GROUNDED: 2, //Grounded
	SLIDING: 4, //Sliding
	AERIAL: 8, //In the air
	COLLIDING_FLOOR: 16, //Colliding with floor
	COLLIDING_WALL: 32, //Colliding with floor
	COLLIDING_CEILING: 64 //Colliding with floor
};

class Collision {
	constructor(frame, stage, position, next_position, momentum, state, tumble, launch_speed, angle) {
		this.collisionOccurred = false;
		this.collision_data = {
			"next_position": next_position,
			"resetGravity": false,
			"launchSpeed": launch_speed,
			"angle": angle,
			"momentum": momentum,
			"state": state,
			"collision": null,
			"intersection": null,
			"lineType": null,
			"slideDirection": 0 //0 none, -1 left, 1 right
		};

		if (stage == null)
			return;

		var launch_line = [position, next_position];
		var launch_angle = LineAngle(launch_line);

		var collisionFound = false;

		//Check stage collisions
		for (var i = 0; i < stage.collisions.length; i++) {

			var intersections = IntersectionLines(launch_line, stage.collisions[i].vertex);

			if (intersections.length == 0)
				continue; //No intersections found

			var material, normal;
			//Calculate distance for all stage lines intersections
			for (var j = 0; j < intersections.length; j++) {
				intersections[j].distance = LineDistance(position, intersections[j].line);
			}

			intersections.sort(function (a, b) {
				if (a.distance < b.distance) {
					return -1;
				} else if (a.distance > b.distance) {
					return 1;
				}
				return 0;
			});

			var intersection = intersections[0];

			//Get passthrough angle
			material = stage.collisions[i].materials[intersection.i];
			//Check if angle between current position and possible next position make collision with line
			if (!LineCollision(launch_angle, material.passthroughAngle))
				break;

			//Found collision
			collisionFound = true;

			//Prepare data
			var lineType = GetLineType(material);
			this.collision_data.next_position = intersection.point;
			this.collision_data.collision = stage.collisions[i];
			this.collision_data.intersection = intersection;
			this.collision_data.lineType = lineType;

			//Check if it bounces off the wall/floor/ceiling
			if (tumble) {
				//Collides and Bounces off
				if (lineType == LineTypes.FLOOR) {
					this.collision_data.resetGravity = true;
					this.collision_data.state = CharacterState.COLLIDING_FLOOR;
				}
				else if (lineType == LineTypes.WALL) {
					this.collision_data.resetGravity = false;
					this.collision_data.state = CharacterState.COLLIDING_WALL;
				}
				else {
					this.collision_data.resetGravity = false;
					this.collision_data.state = CharacterState.COLLIDING_CEILING;
				}
				//Calculate bounced off angle
				var rAngle = (2 * (material.passthroughAngle)) - 180 - launch_angle;
				launch_speed.x = Math.abs(launch_speed.x * 0.8);
				launch_speed.y = Math.abs(launch_speed.y * 0.8);
				if (Math.cos(rAngle * Math.PI / 180) < 0) {
					launch_speed.x *= -1;
				}
				if (Math.sin(rAngle * Math.PI / 180) < 0) {
					launch_speed.y *= -1;
				}

				this.collision_data.angle = rAngle;
				this.collision_data.launchSpeed = launch_speed;

				if (Math.sin(rAngle * Math.PI / 180) > 0) {
					momentum = 1;
				} else if (Math.sin(rAngle * Math.PI / 180) < 0) {
					momentum = -1;
				} else {
					momentum = 0;
				}

				this.collision_data.momentum = momentum;



			} else {
				//Doesn't collide/bounce off

				if (lineType == LineTypes.FLOOR) {
					this.collision_data.resetGravity = true;
					this.collision_data.state = CharacterState.SLIDING;

					var sAngle = LineAngle(intersection.line);
					//Direction of the slope
					if (Math.cos(angle * Math.PI / 180) > 0) {
						this.collision_data.slideDirection = 1;
						if (Math.cos(sAngle * Math.PI / 180) < 0) {
							sAngle = ((sAngle - 180) + 360) % 360;
						}
					} else if (Math.cos(angle * Math.PI / 180) < 0) {
						this.collision_data.slideDirection = -1;
						if (Math.cos(sAngle * Math.PI / 180) > 0) {
							sAngle = (sAngle + 180) % 360;
						}
					}
					this.collision_data.angle = sAngle;

					if (this.collision_data.launchSpeed.x > 8.3) {
						this.collision_data.launchSpeed.x = 8.3;
					}
					this.collision_data.launchSpeed.y = 0;

					if (Math.sin(sAngle * Math.PI / 180) > 0) {
						momentum = 1;
					} else if (Math.sin(sAngle * Math.PI / 180) < 0) {
						momentum = -1;
					} else {
						momentum = 0;
					}

					var p = ClosestPointToLine(GetPointFromSlide(intersection.point, this.collision_data.launchSpeed, sAngle, intersection.line), intersection.line);
					this.collision_data.next_position = [p[0], p[1]];
				}
				else if (lineType == LineTypes.WALL) {
					this.collision_data.resetGravity = false;
					this.collision_data.state = CharacterState.AERIAL;
				}
				else {
					this.collision_data.resetGravity = false;
					this.collision_data.state = CharacterState.AERIAL;
				}



			}

			if (collisionFound)
				break;
		}

		this.collisionOccurred = collisionFound;

		if (collisionFound)
			return;

		//Check platforms

		//If momentum isn't -1 (character is going down) don't check platform collisions
		if (momentum != -1)
			return;

		for (var i = 0; i < stage.platforms.length; i++) {
			var intersections = IntersectionLines(launch_line, stage.platforms[i].vertex);


			if (intersections.length == 0)
				continue; //No intersections found

			var material, normal;
			//Calculate distance for all stage lines intersections
			for (var j = 0; j < intersections.length; j++) {
				intersections[j].distance = LineDistance(position, intersections[j].line);
			}

			intersections.sort(function (a, b) {
				if (a.distance < b.distance) {
					return -1;
				} else if (a.distance > b.distance) {
					return 1;
				}
				return 0;
			});

			var intersection = intersections[0];

			//Get passthrough angle
			material = stage.platforms[i].materials[intersection.i];
			//Check if angle between current position and possible next position make collision with line
			if (!LineCollision(launch_angle, material.passthroughAngle))
				return;

			//Found collision
			collisionFound = true;

			//Prepare data
			var lineType = GetLineType(material);
			this.collision_data.next_position = intersection.point;
			this.collision_data.collision = stage.platforms[i];
			this.collision_data.intersection = intersection;
			this.collision_data.lineType = lineType;

			//Check if it bounces off the wall/floor/ceiling
			if (tumble) {
				//Collides and Bounces off
				if (lineType == LineTypes.FLOOR) {
					this.collision_data.resetGravity = true;
					this.collision_data.state = CharacterState.COLLIDING_FLOOR;
				}
				else if (lineType == LineTypes.WALL) {
					this.collision_data.resetGravity = false;
					this.collision_data.state = CharacterState.COLLIDING_WALL;
				}
				else {
					this.collision_data.resetGravity = false;
					this.collision_data.state = CharacterState.COLLIDING_CEILING;
				}
				//Calculate bounced off angle
				var rAngle = (2 * (material.passthroughAngle)) - 180 - launch_angle;
				launch_speed.x = Math.abs(launch_speed.x * 0.8);
				launch_speed.y = Math.abs(launch_speed.y * 0.8);
				if (Math.cos(rAngle * Math.PI / 180) < 0) {
					launch_speed.x *= -1;
				}
				if (Math.sin(rAngle * Math.PI / 180) < 0) {
					launch_speed.y *= -1;
				}

				this.collision_data.angle = rAngle;
				this.collision_data.launchSpeed = launch_speed;

				if (Math.sin(rAngle * Math.PI / 180) > 0) {
					momentum = 1;
				} else if (Math.sin(rAngle * Math.PI / 180) < 0) {
					momentum = -1;
				} else {
					momentum = 0;
				}

				this.collision_data.momentum = momentum;



			} else {
				//Doesn't collide/bounce off

				if (lineType == LineTypes.FLOOR) {
					this.collision_data.resetGravity = true;
					this.collision_data.state = CharacterState.SLIDING;

					var sAngle = LineAngle(intersection.line);
					//Direction of the slope
					if (Math.cos(angle * Math.PI / 180) > 0) {
						this.collision_data.slideDirection = 1;
						if (Math.cos(sAngle * Math.PI / 180) < 0) {
							sAngle = ((sAngle - 180) + 360) % 360;
						}
					} else if (Math.cos(angle * Math.PI / 180) < 0) {
						this.collision_data.slideDirection = -1;
						if (Math.cos(sAngle * Math.PI / 180) > 0) {
							sAngle = (sAngle + 180) % 360;
						}
					}
					this.collision_data.angle = sAngle;

					if (Math.sin(sAngle * Math.PI / 180) > 0) {
						momentum = 1;
					} else if (Math.sin(sAngle * Math.PI / 180) < 0) {
						momentum = -1;
					} else {
						momentum = 0;
					}

					if (this.collision_data.launchSpeed.x > 8.3) {
						this.collision_data.launchSpeed.x = 8.3;
					}
					this.collision_data.launchSpeed.y = 0;

					var p = ClosestPointToLine(GetPointFromSlide(intersection.point, this.collision_data.launchSpeed, sAngle, intersection.line), intersection.line);
					this.collision_data.next_position = [p[0], p[1]];

				}
				else if (lineType == LineTypes.WALL) {
					this.collision_data.resetGravity = false;
					this.collision_data.state = CharacterState.AERIAL;
				}
				else {
					this.collision_data.resetGravity = false;
					this.collision_data.state = CharacterState.AERIAL;
				}



			}

			if (collisionFound) {
				this.collisionOccurred = true;
				return;
			}
		}
	}
}

class Distance {
	constructor(kb, x_launch_speed, y_launch_speed, hitstun, angle, di, gravity, faf, fall_speed, traction, inverseX, onSurface, position, stage, doPlot, extraFrames) {
		this.kb = kb;
		this.x_launch_speed = x_launch_speed;
		this.y_launch_speed = y_launch_speed;
		this.hitstun = hitstun;
		this.angle = angle;
		this.gravity = gravity;
		this.fall_speed = fall_speed;
		this.traction = traction;
		this.max_x = 0;
		this.max_y = 0;
		this.graph_x = 0;
		this.graph_y = 0;
		this.inverseX = inverseX;
		this.onSurface = onSurface;
		this.tumble = false;
		this.position = { "x": 0, "y": 0 };
		this.bounce = false;
		this.extraFrames = 20;
		this.finalPosition = position;
		this.extra = [];
		if (typeof extraFrames != "undefined") {
			this.extraFrames = extraFrames;
		}

		if (typeof position != "undefined") {
			this.position = position;
		}
		this.stage = null;
		if (typeof stage != "undefined") {
			this.stage = stage;
		}
		if (kb > 80 && angle != 0 && angle != 180) {
			this.tumble = true;
		}

		if (this.stage == null) {
			if (this.position.y < 0 && this.onSurface) {
				this.position.y = 0;
			}
		}


		this.max_x = this.position.x;
		this.max_y = this.position.y;

		var x_speed = +this.x_launch_speed.toFixed(6);
		var y_speed = +this.y_launch_speed.toFixed(6);

		this.KO = false;

		if (this.inverseX) {
			angle = InvertXAngle(angle);
		}
		if (Math.cos(angle * Math.PI / 180) < 0) {
			x_speed *= -1;
		}
		if (Math.sin(angle * Math.PI / 180) < 0) {
			y_speed *= -1;
		}
		this.x = [this.position.x];
		this.y = [this.position.y];
		var decay = { 'x': parameters.decay * Math.cos(angle * Math.PI / 180), 'y': parameters.decay * Math.sin(angle * Math.PI / 180) };
		var character_position = { 'x': this.position.x, 'y': this.position.y };
		var launch_speed = { 'x': x_speed, 'y': y_speed };
		var next_position = { 'x': 0, 'y': 0 };
		var character_speed = { 'x': 0, 'y': 0 };
		this.vertical_speed = [];
		this.horizontal_speed = [];
		var momentum = 1;
		var g = 0;
		var fg = 0;
		this.bounce_frame = -1;
		this.bounce_speed = 0;
		var state = CharacterState.LAUNCH_START;

		//if (aerial) {
		//	state |= CharacterState.AERIAL;
		//} else {
		//	state |= CharacterState.GROUNDED;
		//}

		this.launch_speeds = [];
		var limit = hitstun < 200 ? hitstun + this.extraFrames : 200;

		var previousCollisionIntersection = null;
		var previousCollision = null;

		var slidingDirection = 0;

		for (var i = 0; i < limit; i++) {

			


			var next_x = character_position.x + launch_speed.x + character_speed.x;
			var next_y = character_position.y + launch_speed.y + character_speed.y;

			var prev_state = state;

			next_position.x = next_x;
			next_position.y = next_y;

			this.launch_speeds.push(Math.sqrt(Math.pow(launch_speed.x, 2) + Math.pow(launch_speed.y, 2)));

			this.horizontal_speed.push((launch_speed.x));
			this.vertical_speed.push((launch_speed.y));

			//Vertical direction
			if (next_y > character_position.y) {
				momentum = 1;
			} else if (next_y < character_position.y) {
				momentum = -1;
			} else {
				momentum = 0;
			}

			var countGravity = true;

			//Stage detection
			if (this.stage != null) {
				var c = new Collision(i, this.stage, [character_position.x, character_position.y], [next_x, next_y], momentum, state, this.tumble, launch_speed, angle);

				if (c.collisionOccurred) {
					launch_speed = c.collision_data.launchSpeed;
					next_x = c.collision_data.next_position[0];
					next_y = c.collision_data.next_position[1];
					angle = c.collision_data.angle;
					momentum = c.collision_data.momentum;
					state = c.collision_data.state;
					previousCollision = c.collision_data.collision;
					previousCollisionIntersection = c.collision_data.intersection;
					slidingDirection = c.collision_data.slideDirection;
					decay = { 'x': parameters.decay * Math.cos(angle * Math.PI / 180), 'y': parameters.decay * Math.sin(angle * Math.PI / 180) };

					if (c.collision_data.resetGravity) {
						g = 0;
						fg = 0;
						countGravity = false;
					}
				} else {
					if (((state & CharacterState.SLIDING) == CharacterState.SLIDING) && previousCollision != null) {
						countGravity = false;
						g = 0;
						fg = 0;
						character_speed.y = 0;
						if (!PointInLine([character_position.x, character_position.y], previousCollisionIntersection.line)) {
							//Check if the next position is in the line next to the one that started the slide
							var prev_index = (previousCollisionIntersection.i - 1) % previousCollision.vertex.length;
							var next_index = (previousCollisionIntersection.i + 1) % previousCollision.vertex.length;
							var next_index2 = (previousCollisionIntersection.i + 2) % previousCollision.vertex.length;
							if (prev_index == -1) {
								prev_index = previousCollision.vertex.length - 1;
							}
							//Get line that is on the direction of sliding direction
							var prev_line = [previousCollision.vertex[prev_index], previousCollision.vertex[previousCollisionIntersection.i]];
							var next_line = [previousCollision.vertex[next_index], previousCollision.vertex[next_index2]];
							var prev_line_floor = GetLineType(previousCollision.materials[prev_index]) == LineTypes.FLOOR;
							var next_line_floor = GetLineType(previousCollision.materials[next_index]) == LineTypes.FLOOR;
							var material = null;
							var selected_line = null;
							var selected_index = 0;
							if (slidingDirection == -1) {
								//Left
								if (prev_line[0][0] < previousCollisionIntersection.line[0][0] && prev_line_floor) {
									selected_line = prev_line;
									selected_index = prev_index;
									material = previousCollision.materials[prev_index];
								} else if (next_line[0][0] < previousCollisionIntersection.line[0][0] && next_line_floor) {
									selected_line = next_line;
									selected_index = next_index;
									material = previousCollision.material[next_index];
								}
							} else if (slidingDirection == 1) {
								//Right
								if (prev_line[0][0] > previousCollisionIntersection.line[0][0] && prev_line_floor) {
									selected_line = prev_line;
									selected_index = prev_index;
									material = previousCollision.materials[prev_index];
								} else if (next_line[0][0] > previousCollisionIntersection.line[0][0] && next_line_floor) {
									selected_line = next_line;
									selected_index = next_index;
									material = previousCollision.materials[next_index];
								}
							} else {
								//Landed on this point and doesn't have horizontal momentum, so we end here
								for (var ii = i; ii <= hitstun; i++) {
									//Fill the rest of the data until hitstun end
									this.x.push(+character_position.x.toFixed(6));
									this.y.push(+character_position.y.toFixed(6));
								}
								break;
							}

							if (selected_line != null) {

								//We have the next line the character will continue to slide, recalculate angle and get next point
								previousCollisionIntersection.line = selected_line;
								previousCollisionIntersection.i = selected_index;
								previousCollisionIntersection.point = p;

								var sAngle = LineAngle(selected_line);
								//Direction of the slope
								if (slidingDirection == 1) {
									if (Math.cos(sAngle * Math.PI / 180) < 0) {
										sAngle = ((sAngle - 180) + 360) % 360;
									}
								} else if (slidingDirection == -1) {
									if (Math.cos(sAngle * Math.PI / 180) > 0) {
										sAngle = (sAngle + 180) % 360;
									}
								}
								angle = sAngle;

								launch_speed.y = 0;

								if (Math.sin(sAngle * Math.PI / 180) > 0) {
									momentum = 1;
								} else if (Math.sin(sAngle * Math.PI / 180) < 0) {
									momentum = -1;
								} else {
									momentum = 0;
								}

								var p = ClosestPointToLine(GetPointFromSlide([character_position.x, character_position.y], launch_speed, angle, selected_line), selected_line);
								next_x = p[0];
								next_y = p[1];

							} else {
								state &= 0x9;
								state |= CharacterState.AERIAL;
								slidingDirection = 0;
							}
						} else {
							//Same line
							var p = ClosestPointToLine(GetPointFromSlide([character_position.x, character_position.y], launch_speed, angle, previousCollisionIntersection.line), previousCollisionIntersection.line);
							next_x = p[0];
							next_y = p[1];

						}
					} else {
						state &= 0x9;
						state |= CharacterState.AERIAL;
						slidingDirection = 0;
					}
				}
			} else {
				state &= 0x9;
				state |= CharacterState.AERIAL;
				slidingDirection = 0;
			}

			if (((state & CharacterState.SLIDING) == CharacterState.SLIDING)) {
				//Sliding on surface
				//Traction applied here
				if (launch_speed.x != 0) {
					var x_dir = launch_speed.x / Math.abs(launch_speed.x);
					if (launch_speed.x < 0) {
						launch_speed.x += traction;
					} else {
						launch_speed.x -= traction;
					}
					if (x_dir == -1 && launch_speed.x > 0) {
						launch_speed.x = 0;
					} else if (x_dir == 1 && launch_speed.x < 0) {
						launch_speed.x = 0;
					}
				}
				if (launch_speed.y != 0) {
					var y_dir = launch_speed.y / Math.abs(launch_speed.y);
					launch_speed.y -= decay.y;
					if (y_dir == -1 && launch_speed.y > 0) {
						launch_speed.y = 0;
					} else if (y_dir == 1 && launch_speed.y < 0) {
						launch_speed.y = 0;
					}
				}
				character_speed.y = 0;
				//launch_speed.y = 0;
				g = 0;
			} else if ((state & (CharacterState.COLLIDING_FLOOR - 1)) != 0) { //Not colliding
				//Apply decay
				if (launch_speed.x != 0) {
					var x_dir = launch_speed.x / Math.abs(launch_speed.x);
					launch_speed.x -= decay.x;
					if (x_dir == -1 && launch_speed.x > 0) {
						launch_speed.x = 0;
					} else if (x_dir == 1 && launch_speed.x < 0) {
						launch_speed.x = 0;
					}
				}
				if (launch_speed.y != 0) {
					var y_dir = launch_speed.y / Math.abs(launch_speed.y);
					launch_speed.y -= decay.y;
					if (y_dir == -1 && launch_speed.y > 0) {
						launch_speed.y = 0;
					} else if (y_dir == 1 && launch_speed.y < 0) {
						launch_speed.y = 0;
					}
				}
				//Gravity
				if (countGravity) {
					g -= gravity;
					fg = Math.max(g, -fall_speed);
					character_speed.y = fg;
				} else {
					character_speed.y = 0;
				}
			}


			character_position.x = next_x;
			character_position.y = next_y;

			this.x.push(+character_position.x.toFixed(6));
			this.y.push(+character_position.y.toFixed(6));


			//Maximum position during hitstun
			if (i < hitstun) {
				if (Math.cos(angle * Math.PI / 180) < 0) {
					this.max_x = Math.min(this.max_x, character_position.x);
				} else {
					this.max_x = Math.max(this.max_x, character_position.x);
				}
				if (Math.sin(angle * Math.PI / 180) <= 0) {
					this.max_y = Math.min(this.max_y, character_position.y);
				} else {
					this.max_y = Math.max(this.max_y, character_position.y);
				}
			}

			if (i == hitstun) {
				this.finalPosition = { "x": character_position.x, "y": character_position.y };
			}

			if (i == 0) {
				state &= 0xFE; //Clear launch start flag
			}
		}

		this.vertical_speed.push((launch_speed.y));

		this.graph_x = Math.abs(this.max_x);
		this.graph_y = Math.abs(this.max_y);

		this.max_x = Math.abs(this.max_x - this.position.x);
		this.max_y = Math.abs(this.max_y - this.position.y);

		this.ko_data = [];

		this.ko_frame = -1;
		this.launch_speed_blast_zone = 0;
		this.crossed_blast_zone = false;

		if (this.stage != null) {
			var data = [];
			var ko = false;
			var crossed = false;
			var character_size = 0;

			//Calculate if KO in blast zones
			for (var i = 0; i <= hitstun && !ko; i++) {
				if (this.y[i] >= this.stage.blast_zones[2] + 30 || this.y[i] <= this.stage.blast_zones[3] - 30) {
					this.ko_data.push({ 'calcValue': "KO", 'x': [this.x[i]], 'y': [this.y[i]], 'mode': 'markers', 'marker': { 'color': 'red', size: 15 }, 'name': "KO" });
					this.ko_frame = i;
					ko = true;
					break;
				}
				if (this.x[i] - character_size <= this.stage.blast_zones[0] || this.x[i] + character_size >= this.stage.blast_zones[1] || this.y[i] - character_size <= this.stage.blast_zones[3]) {
					this.ko_data.push({ 'calcValue': "KO", 'x': [this.x[i]], 'y': [this.y[i]], 'mode': 'markers', 'marker': { 'color': 'red', size: 15 }, 'name': "KO" });
					this.ko_frame = i;
					ko = true;
					break;
				} else {
					if (this.y[i] + character_size >= this.stage.blast_zones[2]) {
						if (this.vertical_speed[i] >= 2.4) { //If it has lower launch speed it will pass the blast zone without a KO
							this.ko_data.push({ 'calcValue': "KO", 'x': [this.x[i]], 'y': [this.y[i]], 'mode': 'markers', 'marker': { 'color': 'red', size: 15 }, 'name': "KO" });
							this.ko_frame = i;
							ko = true;
							break;
						} else {
							if (hitstun < (2.4 / 0.03) * 0.4) { //Hitstun frames is lower than 2.4 launch speed, this is used if the target is hit ON the blast zone
								this.ko_data.push({ 'calcValue': "KO", 'x': [this.x[i]], 'y': [this.y[i]], 'mode': 'markers', 'marker': { 'color': 'red', size: 15 }, 'name': "KO" });
								this.ko_frame = i;
								ko = true;
								break;
							} else {
								//At least get launch speed the opponent had when crossing the blast zone
								if (!crossed) {
									crossed = true;
									this.crossed_blast_zone = true;
									this.launch_speed_blast_zone = this.vertical_speed[i];
								}
							}
						}
					}
				}

			}

			this.KO = ko;
		}

		this.doPlot = function () {
			this.data = [];
			var px = 0;
			var py = 0;
			var cx = px;
			var cy = py;
			var color = "blue";
			var dir = 1;
			var data = [];
			var hc = HitstunCancel(kb, x_launch_speed, y_launch_speed, angle, false);
			var airdodge = hc.airdodge;
			var aerial = hc.aerial;
			for (var i = 0; i < this.x.length; i++) {
				var xdata = [];
				var ydata = [];
				var change = false;
				do {
					px = this.x[i];
					py = this.y[i];
					if (i == 0) {
						if (i + 1 < this.x.length) {
							if (py > this.y[i + 1]) {
								if (dir == 1) {
									change = true;
									dir = -1;
								}
							} else {
								if (py < this.y[i + 1]) {
									if (dir == -1) {
										change = true;
										dir = 1;
									}
								}
							}
						}
					} else {
						if (py < cy) {
							if (dir == 1) {
								change = true;
							}
							dir = -1;
						} else {
							if (dir == -1) {
								change = true;
							}
							dir = 1;
						}
					}
					if (!change) {
						xdata.push(px);
						ydata.push(py);
						cx = px;
						cy = py;
						i++;
					} else {
						if (i != 0) {
							xdata.push(px);
							ydata.push(py);
						}
						i--;
					}
				} while (!change && i < this.x.length);
				if (xdata.length > 0) {
					data.push({ 'calcValue': "Launch", 'x': xdata, 'y': ydata, 'mode': 'lines+markers', 'marker': { 'color': color }, 'line': { 'color': color }, 'name': color == 'blue' ? "" : "" });
				}
				switch (color) {
					case 'blue':
						color = "red";
						break;
					case 'red':
						color = "blue";
						break;
				}
			}

			if (hitstun < this.x.length) {
				data.push({ 'calcValue': "Launch", 'x': [this.x[hitstun]], 'y': [this.y[hitstun]], 'mode': 'markers', 'marker': { 'color': 'brown', 'size': 14 }, 'name': "Hitstun end" });
			}

			if (faf >= 0) {
				if (faf < this.x.length) {
					data.push({ 'calcValue': "Launch", 'x': [this.x[faf]], 'y': [this.y[faf]], 'mode': 'markers', 'marker': { 'color': '#0066FF', 'size': 14 }, 'name': "Attacker FAF" });
				}
			}

			var adxdata = [];
			var adydata = [];

			for (var i = hitstun + 1; i < this.x.length; i++) {
				adxdata.push(this.x[i]);
				adydata.push(this.y[i]);
			}

			if (adxdata.length > 0) {
				data.push({ 'calcValue': "Launch", 'x': adxdata, 'y': adydata, 'mode': 'markers', 'marker': { 'color': 'orange' }, 'name': "Actionable frame" });
			}

			adxdata = [];
			adydata = [];

			if (airdodge < hitstun) {
				for (var i = airdodge; i < hitstun; i++) {
					adxdata.push(this.x[i]);
					adydata.push(this.y[i]);
				}


				if (adxdata.length > 0) {
					data.push({ 'calcValue': "Launch", 'x': adxdata, 'y': adydata, 'mode': 'markers', 'marker': { 'color': 'yellow' }, 'name': "Airdodge cancel" });
				}

			}

			if (aerial < hitstun) {
				adxdata = [];
				adydata = [];
				for (var i = aerial; i < hitstun; i++) {
					adxdata.push(this.x[i]);
					adydata.push(this.y[i]);
				}
				if (adxdata.length > 0) {
					data.push({ 'calcValue': "Launch", 'x': adxdata, 'y': adydata, 'mode': 'markers', 'marker': { 'color': 'green' }, 'name': "Aerial cancel" });
				}

			}

			//Stage blast zones
			if (this.stage != null) {
				adxdata = [];
				adydata = [];
				adxdata.push(this.stage.blast_zones[0]);
				adxdata.push(this.stage.blast_zones[1]);
				adxdata.push(this.stage.blast_zones[1]);
				adxdata.push(this.stage.blast_zones[0]);
				adxdata.push(this.stage.blast_zones[0]);

				adydata.push(this.stage.blast_zones[2]);
				adydata.push(this.stage.blast_zones[2]);
				adydata.push(this.stage.blast_zones[3]);
				adydata.push(this.stage.blast_zones[3]);
				adydata.push(this.stage.blast_zones[2]);

				data.push({ 'calcValue': "Blast zone", 'x': adxdata, 'y': adydata, 'mode': 'lines', 'line': { 'color': 'red' }, 'name': "Blast zone" });

				//Stage Camera bounds
				adxdata = [];
				adydata = [];
				adxdata.push(this.stage.camera[0]);
				adxdata.push(this.stage.camera[1]);
				adxdata.push(this.stage.camera[1]);
				adxdata.push(this.stage.camera[0]);
				adxdata.push(this.stage.camera[0]);

				adydata.push(this.stage.camera[2]);
				adydata.push(this.stage.camera[2]);
				adydata.push(this.stage.camera[3]);
				adydata.push(this.stage.camera[3]);
				adydata.push(this.stage.camera[2]);

				data.push({ 'calcValue': "Camera bounds", 'x': adxdata, 'y': adydata, 'mode': 'lines', 'line': { 'color': 'blue' }, 'name': "Camera bounds" });

				//Stage surface
				adxdata = [];
				adydata = [];
				var adxdata2 = [];
				var adydata2 = [];
				var semi_tech = [];

				for (var i = 0; i < this.stage.collisions.length; i++) {
					adxdata = [];
					adydata = [];
					for (var j = 0; j < this.stage.collisions[i].vertex.length; j++) {
						adxdata.push(this.stage.collisions[i].vertex[j][0]);
						adydata.push(this.stage.collisions[i].vertex[j][1]);

						if (j < this.stage.collisions[i].vertex.length - 1) {
							//Wall jump disabled walls
							adxdata2 = [];
							adydata2 = [];
							if (this.stage.collisions[i].materials[j].noWallJump) {
								adxdata2.push(this.stage.collisions[i].vertex[j][0]);
								adydata2.push(this.stage.collisions[i].vertex[j][1]);
								adxdata2.push(this.stage.collisions[i].vertex[j + 1][0]);
								adydata2.push(this.stage.collisions[i].vertex[j + 1][1]);
								semi_tech.push({ 'calcValue': this.stage.collisions[i].name + " Wall jump disabled wall", 'x': adxdata2, 'y': adydata2, 'mode': 'lines', 'line': { 'color': 'purple' }, 'name': "Wall jump disabled wall" });
							}
							//Small walls
							adxdata2 = [];
							adydata2 = [];
							if (this.stage.collisions[i].materials[j].length <= 7 && (this.stage.collisions[i].materials[j].wall || this.stage.collisions[i].materials[j].ceiling) && !this.stage.collisions[i].materials[j].noWallJump) {
								adxdata2.push(this.stage.collisions[i].vertex[j][0]);
								adydata2.push(this.stage.collisions[i].vertex[j][1]);
								adxdata2.push(this.stage.collisions[i].vertex[j + 1][0]);
								adydata2.push(this.stage.collisions[i].vertex[j + 1][1]);
								semi_tech.push({ 'calcValue': this.stage.collisions[i].name + " small wall", 'x': adxdata2, 'y': adydata2, 'mode': 'lines', 'line': { 'color': 'red' }, 'name': "Semi-techable small wall" });
							}
						}
					}
					data.push({ 'calcValue': this.stage.collisions[i].name, 'x': adxdata, 'y': adydata, 'mode': 'lines', 'line': { 'color': 'green' }, 'name': "Stage" });
				}

				data = data.concat(semi_tech);



				//Stage platforms
				if (typeof this.stage.platforms != "undefined") {
					for (var i = 0; i < this.stage.platforms.length; i++) {
						adxdata = [];
						adydata = [];
						for (var j = 0; j < this.stage.platforms[i].vertex.length; j++) {
							adxdata.push(this.stage.platforms[i].vertex[j][0]);
							adydata.push(this.stage.platforms[i].vertex[j][1]);
						}
						data.push({ 'calcValue': "Platform", 'x': adxdata, 'y': adydata, 'mode': 'lines', 'line': { 'color': 'green' }, 'name': "Platform: " + this.stage.platforms[i].name });
					}
				}


				data = data.concat(this.ko_data);
				this.graph_x = Math.max(this.graph_x, this.stage.blast_zones[1]);
				this.graph_y = Math.max(this.graph_y, this.stage.blast_zones[2]);
			}

			this.plot = data;
		};

		if (!doPlot) {
			this.data = [];
			this.plot = [];
			return;
		}

		this.doPlot();

	}
};

class Knockback {
	constructor(kb, angle, gravity, fall_speed, aerial, windbox, electric, percent, di, launch_rate) {
		this.base_kb = kb;
		if (this.base_kb > 2500) {
			//this.base_kb = 2500;
		}
		this.kb = this.base_kb;
		this.original_angle = angle;
		this.base_angle = angle;
		this.angle_with_di = angle;
		this.angle = angle;
		this.gravity = gravity;
		this.aerial = aerial;
		this.windbox = windbox;
		this.tumble = false;
		this.can_jablock = false;
		this.di_able = false;
		this.fall_speed = fall_speed;
		this.add_gravity_speed = parameters.gravity.mult * (this.gravity - parameters.gravity.constant);
		this.percent = percent;
		this.reeling = false;
		this.spike = false;
		this.di_change = 0;
		this.launch_speed = LaunchSpeed(kb);
		this.lsi = 1;
		this.horizontal_launch_speed = 0;
		this.vertical_launch_speed = 0;
		this.launch_rate = launch_rate;
		this.electric = electric;
		if (typeof this.launch_rate == "undefined") {
			this.launch_rate = 1;
		}
		//if (typeof this.lsi == "undefined") {
		//	this.lsi = 1;
		//}
		this.hitstun = Hitstun(this.base_kb, this.windbox, this.electric);
		if (typeof di != "undefined") {
			this.di = di;
		} else {
			this.di = -1;
		}
		this.calculate = function () {
			this.kb = this.base_kb * this.launch_rate;
			if (this.original_angle == 361) {
				this.base_angle = SakuraiAngle(this.kb, this.aerial);
			}
			this.angle = this.base_angle;
			if (this.base_angle != 0 && this.base_angle != 180) {
				this.tumble = this.kb > 80 && !windbox;
			}
			if ((this.base_angle == 0 || this.base_angle == 180) && this.aerial) {
				this.tumble = this.kb > 80 && !windbox;
			}
			this.di_able = this.tumble;
			if (this.di_able) {
				this.di_change = DI(this.di, this.angle);
				this.angle += this.di_change;
			}
			this.angle_with_di = this.angle;
			this.x = Math.abs(Math.cos(this.angle * Math.PI / 180) * this.kb);
			this.y = Math.abs(Math.sin(this.angle * Math.PI / 180) * this.kb);
			this.add_gravity_speed = parameters.gravity.mult * (this.gravity - parameters.gravity.constant);
			if (!this.tumble) {
				this.add_gravity_speed = 0;
			}
			this.can_jablock = false;
			if (this.angle == 0 || this.angle == 180 || this.angle == 360) {
				if (this.kb != 0 && !this.windbox && !this.aerial) {
					this.can_jablock = true;
				}
			}
			this.spike = this.angle >= 230 && this.angle <= 310;
			if (this.spike) {
				if (this.kb != 0 && !this.windbox && !this.aerial) {
					this.can_jablock = !this.tumble;
				}
			}

			if (this.angle <= 70 || this.angle >= 110) {
				this.reeling = this.tumble && !this.windbox && this.percent >= 100;
			}
			this.launch_speed = LaunchSpeed(this.kb);
			this.horizontal_launch_speed = LaunchSpeed(this.x);
			this.vertical_launch_speed = LaunchSpeed(this.y);

			if (this.tumble) {
				this.vertical_launch_speed += this.add_gravity_speed;
				//Gravity boost changes launch angle
				var x_ref = Math.cos(this.angle * Math.PI / 180);
				var y_ref = Math.sin(this.angle * Math.PI / 180);
				this.angle = Math.atan2(this.vertical_launch_speed, this.horizontal_launch_speed) * 180 / Math.PI;
				if (x_ref < 0) {
					this.angle = InvertXAngle(this.angle);
				}
				if (y_ref < 0) {
					this.angle = InvertYAngle(this.angle);
				}
			}
			if (this.tumble) {
				this.lsi = LSI(this.di, this.angle);
			} else {
				this.lsi = 1;
			}
			this.horizontal_launch_speed *= this.lsi;
			this.vertical_launch_speed *= this.lsi;
			this.hitstun = Hitstun(this.base_kb, this.windbox, this.electric);
		};
		this.addModifier = function (modifier) {
			this.base_kb *= modifier;
			this.calculate();
		};
		this.bounce = function (bounce) {
			if (bounce) {
				this.vertical_launch_speed *= parameters.bounce;
				this.horizontal_launch_speed *= parameters.bounce;
			}
		}
		this.calculate();
	}



};

class PercentFromKnockback {
	constructor(kb, type, base_damage, damage, preDamage, angle, weight, gravity, fall_speed, aerial, bkb, kbg, wbkb, attacker_percent, r, queue, ignoreStale, windbox, electric, launch_rate) {
		this.base_kb = kb;
		if (this.base_kb > 2500) {
			//this.base_kb = 2500;
		}
		this.type = type;
		this.original_angle = angle;
		this.base_angle = angle;
		this.base_damage = base_damage;
		this.preDamage = preDamage;
		this.damage = damage;
		this.angle = angle;
		this.gravity = gravity;
		this.fall_speed = fall_speed;
		this.aerial = aerial;
		this.bkb = bkb;
		this.kbg = kbg;
		this.wbkb = wbkb;
		this.r = r;
		this.windbox = windbox;
		this.weight = weight;
		this.attacker_percent = attacker_percent;
		this.rage = Rage(attacker_percent);
		this.tumble = false;
		this.can_jablock = false;
		this.di_able = false;
		this.add_gravity_speed = 5 * (this.gravity - 0.075);
		this.add_gravity_kb = this.add_gravity_speed / 0.03;
		this.reeling = false;
		this.training_percent = 0;
		this.vs_percent = 0;
		this.queue = queue;
		this.ignoreStale = ignoreStale;
		//this.lsi = lsi;
		this.wbkb_kb = -1;
		this.wbkb_modifier = 1;
		this.electric = electric;

		this.launch_rate = launch_rate;
		if (typeof this.launch_rate == "undefined") {
			this.launch_rate = 1;
		}

		this.best_di = { 'angle_training': 0, 'training': 0, 'angle_vs': 0, 'vs': 0, 'hitstun': 0, 'hitstun_dif': 0 };
		this.worst_di = { 'angle_training': 0, 'training': 0, 'angle_vs': 0, 'vs': 0, 'hitstun': 0, 'hitstun_dif': 0 };

		this.training_formula = function (kb, base_damage, damage, weight, kbg, bkb, r) {
			var s = 1;
			return (500 * kb * (weight + 100) - (r * (kbg * (7 * damage * s * (3 * base_damage * s + 7 * base_damage + 20) + 90 * (weight + 100)) + 500 * bkb * (weight + 100)))) / (7 * kbg * r * (base_damage * (3 * s + 7) + 20)) - preDamage;
		}
		this.vs_formula = function (kb, base_damage, damage, weight, kbg, bkb, r, attacker_percent, queue, ignoreStale) {
			var s = StaleNegation(queue, ignoreStale);
			r = r * Rage(attacker_percent) * this.launch_rate;
			return (500 * kb * (weight + 100) - (r * (kbg * (7 * damage * s * (3 * base_damage * s + 7 * base_damage + 20) + 90 * (weight + 100)) + 500 * bkb * (weight + 100)))) / (7 * kbg * r * (base_damage * (3 * s + 7) + 20)) - preDamage;
		}

		if (this.wbkb == 0) {
			if (this.type == "total") {
				this.kb = kb;
			}
			if (this.type == "x") {
				this.x = kb;
			}
			if (this.type == "y") {
				this.y = kb;
			}
		}


		if (this.wbkb == 0) {
			this.calculate = function () {


				if (this.original_angle == 361) {
					this.base_angle = SakuraiAngle(this.kb, this.aerial);
				}
				this.angle = this.base_angle;

				if (this.original_angle == 361 && !this.aerial && type != "total") {
					//Find the original kb and get the angle
					var angle_found = false;
					for (var temp_kb = 59.999; temp_kb < 88; temp_kb += 0.001) {
						var temp_angle = SakuraiAngle(temp_kb, this.aerial);
						var temp_var = 0;
						if (this.type == "x") {
							temp_var = Math.abs(temp_kb * Math.cos(temp_angle * Math.PI / 180));
							if (temp_var >= this.x) {
								this.angle = temp_angle;
								angle_found = true;
								break;
							}
						}
						if (this.type == "y") {
							temp_var = Math.abs(temp_kb * Math.sin(temp_angle * Math.PI / 180));
							if (temp_var >= this.y) {
								this.angle = temp_angle;
								angle_found = true;
								break;
							}
						}
					}
					if (!angle_found) {
						this.angle = SakuraiAngle(88, this.aerial);
					}
				}

				if (this.wbkb != 0) {
					if (this.type == "x") {
						this.kb = Math.abs(this.x / Math.cos(this.angle * Math.PI / 180));
					}
					if (this.type == "y") {
						this.kb = Math.abs(this.y / Math.sin(this.angle * Math.PI / 180));
					}
				}


				this.hitstun = Hitstun(this.kb, this.windbox, this.electric);

				if (this.base_angle != 0 && this.base_angle != 180) {
					this.tumble = this.kb > 80 && !windbox;
					this.di_able = this.tumble;
				}


                /*if (this.angle == 0 || this.angle == 180  || (this.angle >= 181 && this.angle < 360)) {
                    this.add_gravity_kb = 0;
                }*/
				if (this.kb > 80 && (this.angle != 0 && this.angle != 180)) {
					//this.y *= this.gravity_mult;
					if (this.type == "y") {
						this.kb = Math.abs(this.y / Math.sin(this.angle * Math.PI / 180));
					}
				}

				this.can_jablock = false;
				if (this.angle == 0 || this.angle == 180 || this.angle == 360) {
					if (this.kb != 0 && !this.windbox) {
						this.can_jablock = true;
					}
				}
				if (this.angle >= 240 && this.angle <= 300) {
					if (this.kb != 0 && !this.windbox) {
						this.can_jablock = !this.tumble;
					}
				}
				if (this.angle <= 70 || this.angle >= 110) {
					this.reeling = this.tumble && !this.windbox && this.percent >= 100;

				}

				this.training_percent = this.training_formula(this.kb, this.base_damage, this.damage, this.weight, this.kbg, this.bkb, this.r);
				this.vs_percent = this.vs_formula(this.kb, this.base_damage, this.damage, this.weight, this.kbg, this.bkb, this.r, this.attacker_percent, this.queue, this.ignoreStale);


				//if (this.training_percent < 0) {
				//	this.training_percent = 0;
				//}
				//if (this.training_percent > 999 || isNaN(this.training_percent)) {
				//	this.training_percent = -1;
				//}
				//if (this.vs_percent < 0) {
				//	this.vs_percent = 0;
				//}
				//if (this.vs_percent > 999 || isNaN(this.vs_percent)) {
				//	this.vs_percent = -1;
				//}

				if (isNaN(this.training_percent))
					this.training_percent = null;

				if (isNaN(this.vs_percent))
					this.vs_percent = null;

				if (this.di_able && this.type != "total") {
					var di_angles = [];
					for (var i = 0; i < 360; i++) {
						var di = DI(i, this.angle);
						var angle = this.angle + DI(i, this.angle);
						var kb = this.base_kb;
						if (this.type == "x") {
							kb = Math.abs(kb / Math.cos(angle * Math.PI / 180));
						}
						if (this.type == "y") {
							kb -= this.add_gravity_kb;
							kb = Math.abs(kb / Math.sin(angle * Math.PI / 180));
						}
						var hitstun = Hitstun(kb, this.windbox, this.electric);
						var training = this.training_formula(kb, this.base_damage, this.damage, this.weight, this.kbg, this.bkb, this.r);
						var vs = this.vs_formula(kb, this.base_damage, this.damage, this.weight, this.kbg, this.bkb, this.r, this.attacker_percent, this.queue, this.ignoreStale);
						di_angles.push({ 'angle': i, 'training': training, 'vs': vs, 'hitstun': hitstun });
					}
					di_angles.sort(function (a, b) {
						return a.training < b.training ? 1 :
							a.training > b.training ? -1 :
								0
					});
					this.best_di.angle_training = di_angles[0].angle;
					this.best_di.training = di_angles[0].training;
					this.best_di.hitstun = di_angles[0].hitstun;
					this.best_di.hitstun_dif = this.hitstun - di_angles[0].hitstun;
					this.worst_di.angle_training = di_angles[di_angles.length - 1].angle;
					this.worst_di.training = di_angles[di_angles.length - 1].training;
					this.worst_di.hitstun = di_angles[di_angles.length - 1].hitstun;
					this.worst_di.hitstun_dif = this.hitstun - di_angles[di_angles.length - 1].hitstun;
					di_angles.sort(function (a, b) {
						return a.vs < b.vs ? 1 :
							a.vs > b.vs ? -1 :
								0
					});
					this.best_di.angle_vs = di_angles[0].angle;
					this.best_di.vs = di_angles[0].vs;
					this.worst_di.angle_vs = di_angles[di_angles.length - 1].angle;
					this.worst_di.vs = di_angles[di_angles.length - 1].vs;
					if (this.best_di.training < 0) {
						this.best_di.training = 0;
					}
					if (this.best_di.training > 999 || isNaN(this.best_di.training)) {
						this.best_di.training = -1;
					}
					if (this.best_di.vs < 0) {
						this.best_di.vs = 0;
					}
					if (this.best_di.vs > 999 || isNaN(this.best_di.vs)) {
						this.best_di.vs = -1;
					}
					if (this.worst_di.training < 0) {
						this.worst_di.training = 0;
					}
					if (this.worst_di.training > 999 || isNaN(this.worst_di.training)) {
						this.worst_di.training = -1;
					}
					if (this.worst_di.vs < 0) {
						this.worst_di.vs = 0;
					}
					if (this.worst_di.vs > 999 || isNaN(this.worst_di.vs)) {
						this.worst_di.vs = -1;
					}
				}

			};
		} else {
			this.calculate = function () {
				this.kb = this.base_kb * this.wbkb_modifier;
				this.rage_needed = -1;
				this.vs_percent = 0;
				var wbkb = WeightBasedKB(this.weight, this.bkb, this.wbkb, this.kbg, this.gravity, this.fall_speed, this.r, 0, this.damage, 0, this.angle, this.aerial, this.windbox, -1, 1);
				wbkb.addModifier(this.wbkb_modifier);
				this.wbkb_kb = wbkb.kb;
				if (this.kb <= this.wbkb_kb) {
					this.training_percent = 0;
				}
				if (this.kb > this.wbkb_kb) {
					this.training_percent = -1;
				}
				var rage = this.kb / this.wbkb_kb;
				if (rage >= 1 && rage <= 1.15) {
					this.vs_percent = (5 / 3) * ((460 * rage) - 439);
					this.vs_percent = +this.vs_percent.toFixed(6);
					this.rage_needed = +rage.toFixed(6);
				} else {
					if (this.kb <= this.wbkb_kb) {
						this.vs_percent = 0;
					}
					if (this.kb > this.wbkb_kb) {
						this.vs_percent = -1;
					}
				}
			}
		}
		this.addModifier = function (modifier) {
			this.kb /= modifier;
			this.base_kb /= modifier;
			this.add_gravity_kb /= modifier;
			this.wbkb_modifier *= modifier;
			this.calculate();
		};
		this.bounce = function (bounce) {
			if (bounce) {
				//this.kb /= 0.8;
				this.calculate();
			}
		}
		this.calculate();
	}
};


function KBModifier(value) {
	switch (value) {
		case "crouch":
			return parameters.crouch_cancelling;
		case "grounded":
			return 1; //0.8 applied after hitstun
		case "charging":
			return parameters.interrupted_smash;
		case "none":
			return 1;
	}
	return 1;
}

function HitlagCrouch(value) {
	switch (value) {
		case "crouch":
			return parameters.crouch_hitlag;
	}
	return 1;
}

function HitlagElectric(value) {
	switch (value) {
		case "electric":
			return 1.5;
		case "none":
			return 1;
	}
	return 1;
}

var stages = loadJSON("../Data/Stages/legalstagedata.json");
var allstages = loadJSON("../Data/Stages/allstagedata.json");

function process(data, res) {
	if (typeof data.attacker.character_id == "undefined") {
		data.attacker.character_id = null;
	}
	if (typeof data.attacker.character == "undefined") {
		if (data.attacker.character_id == null) {
			res.status(400).json({
				message: "Error: Attacker character name not defined"
			});
			return null;
		} else {
			data.attacker.character = kh.getCharacterNameFromId(data.attacker.character_id);
		}
	}
	if (data.attacker.character == null) {
		res.status(400).json({
			message: "Error: Attacker character name not defined"
		});
		return null;
	}
	var attacker = new Character(data.attacker.character);
	if (typeof data.attacker.modifier != "undefined")
		if (data.attacker.modifier != null) {
			attacker.modifier = attacker.getModifier(data.attacker.modifier);
		}
	if (typeof data.target.character_id == "undefined") {
		data.target.character_id = null;
	}
	if (typeof data.target.character == "undefined") {
		if (data.target.character_id == null) {
			res.status(400).json({
				message: "Error: Target character name not defined"
			});
			return null;
		} else {
			data.target.character = kh.getCharacterNameFromId(data.target.character_id);
		}
	}
	if (typeof data.target.character == "undefined") {
		res.status(400).json({
			message: "Error: Target character name not defined"
		});
		return null;
	}
	if (data.target.character == null) {
		res.status(400).json({
			message: "Error: Target character name not defined"
		});
		return null;
	}
	var target = new Character(data.target.character);
	if (typeof data.target.modifier != "undefined")
		if (data.target.modifier)
			target.modifier = target.getModifier(data.target.modifier);
	if (typeof data.attacker.kb_dealt != "undefined")
		if (data.attacker.kb_dealt) 
			attacker.modifier.kb_dealt = data.attacker.kb_dealt;
	if (typeof data.attacker.damage_dealt != "undefined")
		if (data.attacker.damage_dealt) 
			attacker.modifier.damage_dealt = data.attacker.damage_dealt;
	if (typeof data.target.kb_received != "undefined")
		if (data.target.kb_received) {
			target.modifier.kb_received = data.target.kb_received;
		}
	if (typeof data.target.damage_taken != "undefined")
		if (data.target.damage_taken) {
			target.modifier.damage_taken = data.target.damage_taken;
			}
	if (typeof data.target.weight != "undefined")
		if (data.target.weight) {
			target.attributes.weight = data.target.weight;
			}
	if (typeof data.target.gravity != "undefined")
		if (data.target.gravity) {
			target.attributes.gravity = data.target.gravity;
			}
	if (typeof data.target.fall_speed != "undefined")
		if (data.target.fall_speed) {
			target.attributes.fall_speed = data.target.fall_speed;
			}
	if (typeof data.target.traction != "undefined")
		if (data.target.traction) {
			target.attributes.traction = data.target.traction;
		}
	if (typeof data.attack.preLaunchDamage == "undefined") {
		data.attack.preLaunchDamage = 0;
	}
	if (data.attack.preLaunchDamage == null) {
		data.attack.preLaunchDamage = 0;
	}
	if (typeof data.attack.hitlag == "undefined") {
		data.attack.hitlag = 1;
	}
	if (data.attack.hitlag == null) {
		data.attack.hitlag = 1;
	}
	var attack = data.attack;
	if (typeof data.attack.name == "undefined")
		data.attack.name = null;
	attack.landingLag = null;
	attack.autoCancel = [];
	if (typeof data.attack.stale_queue == "undefined")
		data.attack.stale_queue = null;
	if (data.attack.stale_queue == null) {
		data.attack.stale_queue = [false, false, false, false, false, false, false, false, false];
	}
	if (typeof data.attack.windbox == "undefined")
		data.attack.windbox = false;
	if (typeof data.attack.is_smash_attack == "undefined")
		data.attack.is_smash_attack = false;
	if (typeof data.attack.projectile == "undefined")
		data.attack.projectile = false;
	if (typeof data.attack.shield_damage == "undefined")
		data.attack.shield_damage = 0;
	if (typeof data.attack.set_weight == "undefined")
		data.attack.set_weight = false;
	if (typeof data.attack.paralyzer == "undefined")
		data.attack.paralyzer = false;
	if (typeof data.attack.aerial_opponent == "undefined")
		data.attack.aerial_opponent = false;
	if (typeof data.attack.ignore_staleness == "undefined")
		data.attack.ignore_staleness = false;
	if (typeof data.attack.mega_man_fsmash == "undefined")
		data.attack.mega_man_fsmash = false;
	if (typeof data.attack.on_witch_time == "undefined")
		data.attack.on_witch_time = false;
	if (data.attacker.name != "Bayonetta") {
		data.attack.on_witch_time = false;
	}
	if (data.attacker.name != "Mega Man") {
		data.attack.mega_man_fsmash = false;
	}
	if (typeof data.attack.unblockable == "undefined")
		data.attack.unblockable = false;
	if (typeof data.attack.charged_frames == "undefined")
		data.attack.charged_frames = 0;

	if (typeof data.modifiers == "undefined")
		data.modifiers = {};

	if (typeof data.modifiers.di == "undefined")
		data.modifiers.di = null;
	if (typeof data.modifiers.no_di == "undefined")
		if (data.modifiers.di != null)
			data.modifiers.no_di = false;
		else
			data.modifiers.no_di = true;
	if (typeof data.modifiers.crouch_cancel == "undefined")
		data.modifiers.crouch_cancel = false;
	if (typeof data.modifiers.electric_attack == "undefined")
		data.modifiers.electric_attack = false;
	if (typeof data.modifiers.interrupted_smash_charge == "undefined")
		data.modifiers.interrupted_smash_charge = false;
	if (typeof data.modifiers.grounded_meteor == "undefined")
		data.modifiers.grounded_meteor = false;
	if (typeof data.modifiers.launch_rate == "undefined")
		data.modifiers.launch_rate = 1;

	var modifiers = data.modifiers;

	var shield_advantage = data.shield_advantage;

	if (typeof shield_advantage == "undefined")
		shield_advantage = {};

	if (typeof shield_advantage.hit_frame == "undefined")
		shield_advantage.hit_frame = null;
	if (typeof shield_advantage.faf == "undefined")
		shield_advantage.faf = null;
	if (typeof shield_advantage.landing_frame == "undefined")
		shield_advantage.landing_frame = null;
	if (shield_advantage.landing_frame == null)
		shield_advantage.landing_frame = shield_advantage.faf;
	if (typeof shield_advantage.use_landing_lag == "undefined")
		shield_advantage.use_landing_lag = false;
	if (typeof shield_advantage.use_autocancel == "undefined")
		shield_advantage.use_autocancel = false;
	if (typeof shield_advantage.powershield == "undefined")
		shield_advantage.powershield = false;

	var stage_data = data.stage;

	if (typeof stage_data == "undefined")
		stage_data = {};

	if (typeof stage_data.name == "undefined")
		stage_data.stage_data = null;

	if (typeof stage_data.name != "undefined")
		if (stage_data.name != null && stage_data.stage_data == null) {
			for (var i = 0; i < stages.length; i++) {
				if (stages[i].stage == stage_data.name) {
					stage_data.stage_data = stages[i];
				}
			}
		}
	if (typeof stage_data.position == "undefined")
		stage_data.position = {};
	if (stage_data.stage_data != null) {
		if (typeof stage_data.position.x == "undefined")
			stage_data.position.x = stage_data.stage_data.center[0];
		if (typeof stage_data.position.y == "undefined")
			stage_data.position.y = stage_data.stage_data.center[1];
	} else {
		stage_data.position = { x: 0, y: 0 };
	}
	if (typeof stage_data.inverse_x == "undefined")
		stage_data.inverse_x = false;
	if (typeof data.attacker.percent == "undefined")
		data.attacker.percent = 0;
	if (data.attacker.percent == null) {
		data.attacker.percent = 0;
	}
	if (typeof data.target.percent == "undefined")
		data.target.percent = 0;
	if (data.target.percent == null) {
		data.target.percent = 0;
	}
	if (typeof data.target.luma_percent == "undefined")
		data.target.luma_percent = 0;
	if (data.target.luma_percent == null) {
		data.target.luma_percent = 0;
	}
	if (typeof data.vs_mode == "undefined")
		data.vs_mode = false;
	return {
		attacker: attacker,
		attacker_percent: data.attacker.percent,
		target: target,
		target_percent: data.target.percent,
		luma_percent: data.target.luma_percent,
		attack: attack,
		modifiers: modifiers,
		shield_advantage: shield_advantage,
		stage: stage_data,
		vs_mode: data.vs_mode
	};
}

function processMoveData(data, moveList) {
	for (var i = 0; i < moveList.length; i++) {
		if (moveList[i].name == data.attack.name) {
			data.attack.base_damage = moveList[i].base_damage;
			data.attack.angle = moveList[i].angle;
			data.attack.bkb = moveList[i].bkb;
			data.attack.wbkb = moveList[i].wbkb;
			data.attack.kbg = moveList[i].kbg;
			data.attack.shield_damage = moveList[i].shieldDamage;
			data.attack.preLaunchDamage = moveList[i].preLaunchDamage;
			if (isNaN(data.attack.preLaunchDamage)) {
				data.attack.preLaunchDamage = 0;
			}
			data.attack.is_smash_attack = moveList[i].smash_attack;
			data.attack.chargeable = moveList[i].chargeable;
			data.attack.charge = moveList[i].charge;
			data.attack.unblockable = moveList[i].unblockable;
			data.attack.windbox = moveList[i].windbox;
			data.attack.landingLag = moveList[i].landingLag;
			data.attack.autoCancel = moveList[i].autoCancel;
			if (data.shield_advantage.hit_frame == null) {
				if (moveList[i].hitboxActive.length > 0) {
					data.shield_advantage.hit_frame = moveList[i].hitboxActive[0].start;
				}
			}
			if (data.shield_advantage.faf == null) {
				data.shield_advantage.faf = moveList[i].faf;
			}
			break;
		}
	}
}

function calculate(data,res) {
	try {
		var results = {};
		var kb;
		var base_damage = data.attack.base_damage;
		var preLaunchDamage = data.attack.preLaunchDamage;

		if (data.attack.is_smash_attack) {
			base_damage = ChargeSmash(base_damage, data.attack.charged_frames, data.attack.mega_man_fsmash, data.attack.on_witch_time);
		}

		if (data.attack.chargeable) {
			if (data.attack.charge != null) {
				base_damage = data.attack.charge.formula(data.attack.base_damage, data.attack.bkb, data.attack.charged_frames)[0].toFixed(6);
				if (data.attack.charge.variable_bkb) {
					data.attack.bkb = data.attack.charge.formula(data.attack.base_damage, data.attack.bkb, data.attack.charged_frames)[1].toFixed(6);
				}
			}
		}

		if (data.attacker.name == "Lucario") {
			if (typeof data.attacker.aura != "undefined") {
				if (data.attacker.aura == null) {
					data.attacker.aura.stock_dif = "0";
					data.attacker.aura.game_mode = "Singles";
				}
			} else {
				data.attacker.aura = { stock_dif: "0", game_mode: "Singles" };
			}

			if (data.vs_mode) {
				base_damage *= Aura(data.attacker_percent, data.attacker.aura.stock_dif, data.attacker.aura.game_mode);
				preLaunchDamage *= Aura(data.attacker_percent, data.attacker.aura.stock_dif, data.attacker.aura.game_mode);
			} else {
				base_damage *= Aura(data.attacker_percent, "0", "Singles");
				preLaunchDamage *= Aura(data.attacker_percent, "0", "Singles");
			}

		}

		var damage = base_damage;
		damage *= data.attacker.modifier.damage_dealt;
		damage *= data.target.modifier.damage_taken;
		preLaunchDamage *= data.attacker.modifier.damage_dealt;
		preLaunchDamage *= data.target.modifier.damage_taken;
		var crouch = 1;
		var electric = "none";
		var r = 1;

		if (data.modifiers.crouch_cancel) {
			r = 0.85;
			crouch = 0.67;
		} else if (data.modifiers.interrupted_smash) {
			r = 1.2;
		}

		if (data.modifiers.electric_attack) {
			electric = "electric";
		}

		var di = data.modifiers.di;
		if (data.modifiers.no_di) {
			di = -1;
		}

		var windbox = data.attack.windbox;
		var is_projectile = data.attack.projectile;
		var ignoreStale = data.attack.ignore_staleness;

		var vs_mode = data.vs_mode;

		if (data.attack.wbkb == 0) {
			//No WBKB moves
			if (vs_mode) {
				kb = VSKB(data.target_percent + preLaunchDamage, base_damage, damage, data.attack.set_weight ? 100 : data.target.attributes.weight, data.attack.kbg, data.attack.bkb, data.target.attributes.gravity * data.target.modifier.gravity, data.target.attributes.fall_speed * data.target.modifier.fall_speed, r, data.attack.stale_queue, data.attack.ignore_staleness, data.attacker_percent, data.attack.angle, data.attack.aerial_opponent, data.attack.windbox, electric, di, data.modifiers.launch_rate);
			} else {
				kb = TrainingKB(data.target_percent + preLaunchDamage, base_damage, damage, data.attack.set_weight ? 100 : data.target.attributes.weight, data.attack.kbg, data.attack.bkb, data.target.attributes.gravity * data.target.modifier.gravity, data.target.attributes.fall_speed * data.target.modifier.fall_speed, r, data.attack.angle, data.attack.aerial_opponent, data.attack.windbox, electric, di, data.modifiers.launch_rate);
			}
			kb.addModifier(data.attacker.modifier.kb_dealt);
			kb.addModifier(data.target.modifier.kb_received);
		} else {
			//WBKB move
			if (vs_mode) {
				kb = WeightBasedKB(data.attack.set_weight ? 100 : data.target.attributes.weight, data.attack.bkb, data.attack.wbkb, data.attack.kbg, data.target.attributes.gravity * data.target.modifier.gravity, data.target.attributes.fall_speed * data.target.modifier.fall_speed, r, data.target_percent, damage, data.attacker_percent, data.attack.angle, data.attack.aerial_opponent, data.attack.windbox, electric, di, data.modifiers.launch_rate);
			} else {
				kb = WeightBasedKB(data.attack.set_weight ? 100 : data.target.attributes.weight, data.attack.bkb, data.attack.wbkb, data.attack.kbg, data.target.attributes.gravity * data.target.modifier.gravity, data.target.attributes.fall_speed * data.target.modifier.fall_speed, r, data.target_percent, damage, 0, data.attack.angle, data.attack.aerial_opponent, data.attack.windbox, electric, di, data.modifiers.launch_rate);
			}
			kb.addModifier(data.target.modifier.kb_received);
		}

		var distance = new Distance(kb.kb, kb.horizontal_launch_speed, kb.vertical_launch_speed, kb.hitstun, kb.angle, kb.di_change, data.target.attributes.gravity * data.target.modifier.gravity, -1, data.target.attributes.fall_speed * data.target.modifier.fall_speed, data.target.attributes.traction * data.target.modifier.traction, data.stage.inverse_x, false, data.stage.position, data.stage.stage_data, true, 0);
		kb.bounce(data.modifiers.grounded_meteor);

		var kb_results = {};

		var hc = HitstunCancel(kb.kb, kb.horizontal_launch_speed, kb.vertical_launch_speed, kb.angle, data.attack.windbox, HitlagElectric(electric));

		kb_results.damage = vs_mode ? +StaleDamage(damage, data.attack.stale_queue, data.attack.ignore_staleness).toFixed(6) : +damage.toFixed(6);
		if (!data.attack.paralyzer) {
			kb_results.attacker_hitlag = vs_mode ? Hitlag(StaleDamage(damage, data.attack.stale_queue, data.attack.ignore_staleness), is_projectile ? 0 : data.attack.hitlag, HitlagElectric(electric), 1) : Hitlag(damage, is_projectile ? 0 : data.attack.hitlag, HitlagElectric(electric), 1);
			kb_results.target_hitlag = vs_mode ? Hitlag(StaleDamage(damage, data.attack.stale_queue, data.attack.ignore_staleness), data.attack.hitlag, HitlagElectric(electric), crouch) : Hitlag(damage, data.attack.hitlag, HitlagElectric(electric), crouch);
			kb_results.paralysis_time = null;
		} else {
			kb_results.attacker_hitlag = vs_mode ? ParalyzerHitlag(StaleDamage(damage, data.attack.stale_queue, data.attack.ignore_staleness), is_projectile ? 0 : data.attack.hitlag, 1) : ParalyzerHitlag(damage, is_projectile ? 0 : data.attack.hitlag, 1);
			kb_results.target_hitlag = null;
			kb_results.paralysis_time = ParalysisTime(kb.kb, damage, data.attack.hitlag, crouch);
		}
		kb_results.kb = +kb.kb.toFixed(6);
		if (kb.di_able) {
			kb_results.angle_with_di = +kb.angle_with_di.toFixed(6);
		}
		kb_results.launch_angle = +kb.angle.toFixed(6);
		if (data.attack.angle <= 361) {
			kb_results.kb_x = +kb.x.toFixed(6);
			kb_results.kb_y = +kb.y.toFixed(6);
		} else {
			kb_results.kb_x = null;
			kb_results.kb_y = null;
		}
		kb_results.hitstun = Hitstun(kb.base_kb, data.attack.windbox, electric);

		kb_results.hitstun_faf = FirstActionableFrame(kb.base_kb, windbox, electric);
		if ((Hitstun(kb.base_kb, windbox, electric) == 0 || Hitstun(kb.base_kb, windbox, electric) + 1 == hc.aerial)) {
			kb_results.airdodge_hitstun_cancel = hc.airdodge;
		} else {
			kb_results.airdodge_hitstun_cancel = null;
		}
		if ((Hitstun(kb.base_kb, windbox, electric) == 0 || Hitstun(kb.base_kb, windbox, electric) + 1 == hc.aerial)) {
			kb_results.aerial_hitstun_cancel = hc.aerial;
		} else {
			kb_results.aerial_hitstun_cancel = null;
		}
		

		kb_results.tumble = kb.tumble;

		kb_results.reeling = kb.reeling;

		if (kb.reeling) {	
			kb_results.reeling_hitstun = Hitstun(kb.base_kb, windbox, electric, true);
			kb_results.reeling_faf = FirstActionableFrame(kb.base_kb, windbox, electric, true);
		} else {
			kb_results.reeling_hitstun = null;
			kb_results.reeling_faf = null;
		}
		

		kb_results.can_jab_lock = kb.can_jablock;

		kb_results.lsi = +kb.lsi.toFixed(6);
		kb_results.horizontal_launch_speed = +kb.horizontal_launch_speed.toFixed(6);
		kb_results.gravity_boost = +kb.add_gravity_speed.toFixed(6);
		kb_results.vertical_launch_speed = +kb.vertical_launch_speed.toFixed(6);
		kb_results.max_horizontal_distance = +distance.max_x.toFixed(6);
		kb_results.max_vertical_distance = +distance.max_y.toFixed(6);
		kb_results.kb_modifier = +r.toFixed(6);
		kb_results.rage = vs_mode ? +Rage(data.attacker_percent).toFixed(6) : 1;
		kb_results.kb_received = +data.target.modifier.kb_received.toFixed(6);
		kb_results.launch_rate = vs_mode ? +data.modifiers.launch_rate.toFixed(6) : 1;
		kb_results.kb_dealt = +data.attacker.modifier.kb_dealt.toFixed(6);
		if (data.attacker.name == "Lucario") {
			kb_results.aura = vs_mode ? +Aura(data.attacker_percent, data.attacker.aura.stock_dif, data.attacker.aura.game_mode).toFixed(6) : +Aura(data.attacker_percent, "0", "Singles").toFixed(6);
		} else {
			kb_results.aura = null;
		}
		kb_results.charged_smash_damage_multiplier = data.attack.is_smash_attack ? +ChargeSmashMultiplier(data.attack.charged_frames, data.attack.mega_man_fsmash, data.attack.on_witch_time).toFixed(6) : 1;
		kb_results.damage_taken = +data.target.modifier.damage_taken.toFixed(6);
		kb_results.damage_dealt = +data.attacker.modifier.damage_dealt.toFixed(6);
		kb_results.preLaunchDamage = vs_mode ? +(preLaunchDamage * StaleNegation(data.attack.stale_queue, data.attack.ignore_staleness)).toFixed(6) : +preLaunchDamage.toFixed(6);
		kb_results.stale_negation = vs_mode ? +StaleNegation(data.attack.stale_queue, data.attack.ignore_staleness).toFixed(6) : 1;

		kb_results.hit_advantage = null;
		kb_results.unblockable = false;
		kb_results.shield_damage = null;
		kb_results.full_shield_hp = +(50 * data.target.modifier.shield).toFixed(6);
		kb_results.shield_break = null;
		kb_results.shield_hitlag = null;
		kb_results.shield_stun = null;
		kb_results.shield_advantage = null;

		if ((data.shield_advantage.faf != null || data.shield_advantage.landing_frame != null) && data.shield_advantage.hit_frame != null) {
			var faf = data.shield_advantage.faf;
			
			if (data.modifiers.use_landing_lag && data.attack.landingLag != null && data.attack.landing_frame != null) {
				var landing_lag = data.attack.landingLag;
				faf = data.shield_advantage.landing_frame + landing_lag;
				kb_results.hit_advantage = HitAdvantage(kb.hitstun, data.shield_advantage.hit_frame, faf);
			} else if (data.modifiers.use_autocancel && data.attack.autoCancel.length > 0 && data.attack.landing_frame != null) {
				faf = data.shield_advantage.landing_frame;
				var i = data.shield_advantage.hit_frame;
				var h = data.shield_advantage.hit_frame + 50;
                var f = false;
				for (i = data.shield_advantage.hit_frame; i < h; i++) {
					for (var x = 0; x < data.attack.autoCancel.length; x++) {
						if (data.attack.autoCancel[x].eval(i)) {
							f = true;
							break;
						}
					}
					if (f)
						break;
				}
				if (f) {
					faf = i + attacker.attributes.hard_landing_lag;
					kb_results.hit_advantage = HitAdvantage(kb.hitstun, data.shield_advantage.hit_frame, faf);
				} else {
					if (data.shield_advantage.faf != null) {
						faf = data.shield_advantage.faf;
						kb_results.hit_advantage = HitAdvantage(kb.hitstun, data.shield_advantage.hit_frame, faf);
					}
				}
			} else if (data.shield_advantage.faf != null) {
				faf = data.shield_advantage.faf;
				kb_results.hit_advantage = HitAdvantage(kb.hitstun, data.shield_advantage.hit_frame, faf);
			}

			if (faf != null) {

				//Shield advantage
				if (!data.attack.unblockable) {
					kb_results.unblockable = false;
					if (!data.shield_advantage.powershield) {
						var s = (base_damage * data.attacker.modifier.damage_dealt * 1.19) + (data.attack.shield_damage * 1.19);
						var sv = (StaleDamage(base_damage, data.attack.stale_queue, data.attack.ignore_staleness) * data.attacker.modifier.damage_dealt * 1.19) + (data.attack.shield_damage * 1.19);
						kb_results.shield_damage = vs_mode ? +sv.toFixed(6) : +s.toFixed(6);
						kb_results.full_shield_hp = +(50 * data.target.modifier.shield).toFixed(6);
						kb_results.shield_break = vs_mode ? sv >= 50 * data.target.modifier.shield : s >= 50 * data.target.modifier.shield;
					}
					kb_results.shield_hitlag = vs_mode ? ShieldHitlag(StaleDamage(damage, data.attack.stale_queue, data.attack.ignore_staleness), data.attack.hitlag, HitlagElectric(electric)) : ShieldHitlag(damage, data.attack.hitlag, HitlagElectric(electric));
					kb_results.shield_stun = vs_mode ? ShieldStun(StaleDamage(damage, data.attack.stale_queue, data.attack.ignore_staleness), data.attack.is_projectile, data.modifiers.powershield) : ShieldStun(damage, data.attack.is_projectile, data.modifiers.powershield);
					kb_results.shield_advantage = vs_mode ? ShieldAdvantage(StaleDamage(damage, data.attack.stale_queue, data.attack.ignore_staleness), data.attack.hitlag, data.shield_advantage.hit_frame, faf, data.attack.is_projectile, HitlagElectric(electric), data.modifiers.powershield) : ShieldAdvantage(damage, data.attack.hitlag, data.shield_advantage.hit_frame, faf, data.attack.is_projectile, HitlagElectric(electric), data.modifiers.powershield);
				}
				else {
					kb_results.unblockable = true;
				}

			}

			
		}

		kb_results.luma_kb = null;
		kb_results.luma_launched = null;

		if (data.target.name == "Rosalina And Luma") {
			var luma_kb;
			if (data.attack.wbkb == 0) {
				//No WBKB moves
				if (vs_mode) {
					luma_kb = VSKB(15 + data.luma_percent, base_damage, damage, 100, data.attack.kbg, data.attack.bkb, data.target.attributes.gravity * data.target.modifier.gravity, data.target.attributes.fall_speed * data.target.modifier.fall_speed, r, data.attack.stale_queue, data.attack.ignore_staleness, data.attacker_percent, data.attack.angle, data.attack.aerial_opponent, data.attack.windbox, electric, di, data.modifiers.launch_rate);
				} else {
					luma_kb = TrainingKB(15 + data.luma_percent, base_damage, damage, 100, data.attack.kbg, data.attack.bkb, data.target.attributes.gravity * data.target.modifier.gravity, data.target.attributes.fall_speed * data.target.modifier.fall_speed, r, data.attack.angle, data.attack.aerial_opponent, data.attack.windbox, electric, di, data.modifiers.launch_rate);
				}
				luma_kb.addModifier(data.attacker.modifier.kb_dealt);
				luma_kb.addModifier(data.target.modifier.kb_received);
			} else {
				//WBKB move
				if (vs_mode) {
					luma_kb = WeightBasedKB(100, data.attack.bkb, data.attack.wbkb, data.attack.kbg, data.target.attributes.gravity * data.target.modifier.gravity, data.target.attributes.fall_speed * data.target.modifier.fall_speed, r, 15 + data.luma_percent, damage, data.attacker_percent, data.attack.angle, data.attack.aerial_opponent, data.attack.windbox, electric, di, data.modifiers.launch_rate);
				} else {
					luma_kb = WeightBasedKB(100, data.attack.bkb, data.attack.wbkb, data.attack.kbg, data.target.attributes.gravity * data.target.modifier.gravity, data.target.attributes.fall_speed * data.target.modifier.fall_speed, r, 15 + data.luma_percent, damage, 0, data.attack.angle, data.attack.aerial_opponent, data.attack.windbox, electric, di, data.modifiers.launch_rate);
				}
				luma_kb.addModifier(data.target.modifier.kb_received);
			}
			kb_results.luma_kb = +luma_kb.kb.toFixed(6);
			kb_results.luma_launched = luma_kb.tumble;
		}


		results = kb_results;

		results.ko = distance.KO;

		if (distance.KO) {
			results.ko_frame = distance.ko_frame;
		} else {
			if (distance.crossed_blast_zone) {
				results.vertical_blast_zone_crossed = true;
				results.vertical_launch_speed_on_blast_zone = distance.launch_speed_blast_zone;
			}
		}

		results.launch_trajectory = [];

		

		for (var i = 0; i < distance.hitstun; i++) {
			results.launch_trajectory.push({
				frame: i,
				position: {
					x: distance.x[i],
					y: distance.y[i]
				},
				launch_speed: {
					x: distance.horizontal_speed[i],
					y: distance.vertical_speed[i]
				}
			});
		}

		

		res.json(results);
	}
	catch (err) {
		res.status(400).json({
			message: "Error processing request"
		});
	}
}

function calculateShieldAdvantage(data, res) {
	try {
		var results = {};
		var kb;
		var base_damage = data.attack.base_damage;
		var preLaunchDamage = data.attack.preLaunchDamage;

		if (data.attack.is_smash_attack) {
			base_damage = ChargeSmash(base_damage, data.attack.charged_frames, data.attack.mega_man_fsmash, data.attack.on_witch_time);
		}

		if (data.attack.chargeable) {
			if (data.attack.charge != null) {
				base_damage = data.attack.charge.formula(data.attack.base_damage, data.attack.bkb, data.attack.charged_frames)[0].toFixed(6);
				if (data.attack.charge.variable_bkb) {
					data.attack.bkb = data.attack.charge.formula(data.attack.base_damage, data.attack.bkb, data.attack.charged_frames)[1].toFixed(6);
				}
			}
		}

		if (data.attacker.name == "Lucario") {
			if (typeof data.attacker.aura != "undefined") {
				if (data.attacker.aura == null) {
					data.attacker.aura.stock_dif = "0";
					data.attacker.aura.game_mode = "Singles";
				}
			} else {
				data.attacker.aura = { stock_dif: "0", game_mode: "Singles" };
			}

			if (data.vs_mode) {
				base_damage *= Aura(data.attacker_percent, data.attacker.aura.stock_dif, data.attacker.aura.game_mode);
				preLaunchDamage *= Aura(data.attacker_percent, data.attacker.aura.stock_dif, data.attacker.aura.game_mode);
			} else {
				base_damage *= Aura(data.attacker_percent, "0", "Singles");
				preLaunchDamage *= Aura(data.attacker_percent, "0", "Singles");
			}

		}

		var damage = base_damage;
		damage *= data.attacker.modifier.damage_dealt;
		damage *= data.target.modifier.damage_taken;
		preLaunchDamage *= data.attacker.modifier.damage_dealt;
		preLaunchDamage *= data.target.modifier.damage_taken;
		var crouch = 1;
		var electric = "none";
		var r = 1;

		if (data.modifiers.crouch_cancel) {
			r = 0.85;
			crouch = 0.67;
		} else if (data.modifiers.interrupted_smash) {
			r = 1.2;
		}

		if (data.modifiers.electric_attack) {
			electric = "electric";
		}

		var di = data.modifiers.di;
		if (data.modifiers.no_di) {
			di = -1;
		}

		var windbox = data.attack.windbox;
		var is_projectile = data.attack.projectile;
		var ignoreStale = data.attack.ignore_staleness;

		var vs_mode = data.vs_mode;

		if (data.attack.wbkb == 0) {
			//No WBKB moves
			if (vs_mode) {
				kb = VSKB(data.target_percent + preLaunchDamage, base_damage, damage, data.attack.set_weight ? 100 : data.target.attributes.weight, data.attack.kbg, data.attack.bkb, data.target.attributes.gravity * data.target.modifier.gravity, data.target.attributes.fall_speed * data.target.modifier.fall_speed, r, data.attack.stale_queue, data.attack.ignore_staleness, data.attacker_percent, data.attack.angle, data.attack.aerial_opponent, data.attack.windbox, electric, di, data.modifiers.launch_rate);
			} else {
				kb = TrainingKB(data.target_percent + preLaunchDamage, base_damage, damage, data.attack.set_weight ? 100 : data.target.attributes.weight, data.attack.kbg, data.attack.bkb, data.target.attributes.gravity * data.target.modifier.gravity, data.target.attributes.fall_speed * data.target.modifier.fall_speed, r, data.attack.angle, data.attack.aerial_opponent, data.attack.windbox, electric, di, data.modifiers.launch_rate);
			}
			kb.addModifier(data.attacker.modifier.kb_dealt);
			kb.addModifier(data.target.modifier.kb_received);
		} else {
			//WBKB move
			if (vs_mode) {
				kb = WeightBasedKB(data.attack.set_weight ? 100 : data.target.attributes.weight, data.attack.bkb, data.attack.wbkb, data.attack.kbg, data.target.attributes.gravity * data.target.modifier.gravity, data.target.attributes.fall_speed * data.target.modifier.fall_speed, r, data.target_percent, damage, data.attacker_percent, data.attack.angle, data.attack.aerial_opponent, data.attack.windbox, electric, di, data.modifiers.launch_rate);
			} else {
				kb = WeightBasedKB(data.attack.set_weight ? 100 : data.target.attributes.weight, data.attack.bkb, data.attack.wbkb, data.attack.kbg, data.target.attributes.gravity * data.target.modifier.gravity, data.target.attributes.fall_speed * data.target.modifier.fall_speed, r, data.target_percent, damage, 0, data.attack.angle, data.attack.aerial_opponent, data.attack.windbox, electric, di, data.modifiers.launch_rate);
			}
			kb.addModifier(data.target.modifier.kb_received);
		}

		
		results.unblockable = false;
		results.shield_damage = null;
		results.full_shield_hp = +(50 * data.target.modifier.shield).toFixed(6);
		results.shield_break = null;
		results.shield_hitlag = null;
		results.shield_stun = null;
		results.shield_advantage = null;

		if ((data.shield_advantage.faf != null || data.shield_advantage.landing_frame != null) && data.shield_advantage.hit_frame != null) {
			var faf = data.shield_advantage.faf;

			if (data.modifiers.use_landing_lag && data.attack.landingLag != null && data.attack.landing_frame != null) {
				var landing_lag = data.attack.landingLag;
				faf = data.shield_advantage.landing_frame + landing_lag;
			} else if (data.modifiers.use_autocancel && data.attack.autoCancel.length > 0 && data.attack.landing_frame != null) {
				faf = data.shield_advantage.landing_frame;
				var i = data.shield_advantage.hit_frame;
				var h = data.shield_advantage.hit_frame + 50;
				var f = false;
				for (i = data.shield_advantage.hit_frame; i < h; i++) {
					for (var x = 0; x < data.attack.autoCancel.length; x++) {
						if (data.attack.autoCancel[x].eval(i)) {
							f = true;
							break;
						}
					}
					if (f)
						break;
				}
				if (f) {
					faf = i + attacker.attributes.hard_landing_lag;
				} else {
					if (data.shield_advantage.faf != null) {
						faf = data.shield_advantage.faf;
					}
				}
			} else if (data.shield_advantage.faf != null) {
				faf = data.shield_advantage.faf;
			}

			if (faf != null) {

				//Shield advantage
				if (!data.attack.unblockable) {
					results.unblockable = false;
					if (!data.shield_advantage.powershield) {
						var s = (base_damage * data.attacker.modifier.damage_dealt * 1.19) + (data.attack.shield_damage * 1.19);
						var sv = (StaleDamage(base_damage, data.attack.stale_queue, data.attack.ignore_staleness) * data.attacker.modifier.damage_dealt * 1.19) + (data.attack.shield_damage * 1.19);
						results.shield_damage = vs_mode ? +sv.toFixed(6) : +s.toFixed(6);
						results.full_shield_hp = +(50 * data.target.modifier.shield).toFixed(6);
						results.shield_break = vs_mode ? sv >= 50 * data.target.modifier.shield : s >= 50 * data.target.modifier.shield;
					}
					results.shield_hitlag = vs_mode ? ShieldHitlag(StaleDamage(damage, data.attack.stale_queue, data.attack.ignore_staleness), data.attack.hitlag, HitlagElectric(electric)) : ShieldHitlag(damage, data.attack.hitlag, HitlagElectric(electric));
					results.shield_stun = vs_mode ? ShieldStun(StaleDamage(damage, data.attack.stale_queue, data.attack.ignore_staleness), data.attack.is_projectile, data.modifiers.powershield) : ShieldStun(damage, data.attack.is_projectile, data.modifiers.powershield);
					results.shield_advantage = vs_mode ? ShieldAdvantage(StaleDamage(damage, data.attack.stale_queue, data.attack.ignore_staleness), data.attack.hitlag, data.shield_advantage.hit_frame, faf, data.attack.is_projectile, HitlagElectric(electric), data.modifiers.powershield) : ShieldAdvantage(damage, data.attack.hitlag, data.shield_advantage.hit_frame, faf, data.attack.is_projectile, HitlagElectric(electric), data.modifiers.powershield);
				}
				else {
					results.unblockable = true;
				}

			}


		}

		res.json(results);
	}
	catch (err) {
		res.status(400).json({
			message: "Error processing request"
		});
	}
}

function calculatePercentFromKB(data, res) {
	try {
		var results = {};
		var kb;
		var base_damage = data.attack.base_damage;
		var preLaunchDamage = data.attack.preLaunchDamage;

		if (data.attack.is_smash_attack) {
			base_damage = ChargeSmash(base_damage, data.attack.charged_frames, data.attack.mega_man_fsmash, data.attack.on_witch_time);
		}

		if (data.attack.chargeable) {
			if (data.attack.charge != null) {
				base_damage = data.attack.charge.formula(data.attack.base_damage, data.attack.bkb, data.attack.charged_frames)[0].toFixed(6);
				if (data.attack.charge.variable_bkb) {
					data.attack.bkb = data.attack.charge.formula(data.attack.base_damage, data.attack.bkb, data.attack.charged_frames)[1].toFixed(6);
				}
			}
		}

		if (data.attacker.name == "Lucario") {
			if (typeof data.attacker.aura != "undefined") {
				if (data.attacker.aura == null) {
					data.attacker.aura.stock_dif = "0";
					data.attacker.aura.game_mode = "Singles";
				}
			} else {
				data.attacker.aura = { stock_dif: "0", game_mode: "Singles" };
			}

			if (data.vs_mode) {
				base_damage *= Aura(data.attacker_percent, data.attacker.aura.stock_dif, data.attacker.aura.game_mode);
				preLaunchDamage *= Aura(data.attacker_percent, data.attacker.aura.stock_dif, data.attacker.aura.game_mode);
			} else {
				base_damage *= Aura(data.attacker_percent, "0", "Singles");
				preLaunchDamage *= Aura(data.attacker_percent, "0", "Singles");
			}

		}

		var damage = base_damage;
		damage *= data.attacker.modifier.damage_dealt;
		damage *= data.target.modifier.damage_taken;
		preLaunchDamage *= data.attacker.modifier.damage_dealt;
		preLaunchDamage *= data.target.modifier.damage_taken;
		var crouch = 1;
		var electric = "none";
		var r = 1;

		if (data.modifiers.crouch_cancel) {
			r = 0.85;
			crouch = 0.67;
		} else if (data.modifiers.interrupted_smash) {
			r = 1.2;
		}

		if (data.modifiers.electric_attack) {
			electric = "electric";
		}

		var di = data.modifiers.di;
		if (data.modifiers.no_di) {
			di = -1;
		}

		var windbox = data.attack.windbox;
		var is_projectile = data.attack.projectile;
		var ignoreStale = data.attack.ignore_staleness;

		var vs_mode = data.vs_mode;

		var kb = new PercentFromKnockback(data.kb, "total", base_damage, damage, preLaunchDamage, data.attack.angle, data.attack.set_weight ? 100 : data.target.attributes.weight, data.target.attributes.gravity, data.target.attributes.fall_speed, data.attack.aerial_opponent, data.attack.bkb, data.attack.kbg, data.attack.wbkb, data.attacker_percent, r, data.attack.stale_queue, data.attack.ignore_staleness, data.attack.windbox, electric, data.modifiers.launch_rate);
		if (kb.wbkb == 0) {
			kb.addModifier(data.attacker.modifier.kb_dealt);
		}
		kb.addModifier(data.target.modifier.kb_received);
		kb.bounce(data.attack.grounded_meteor);

		var results = {};

		results.percent = null;
		results.attacker_percent = null;
		results.rage_multiplier = null;
		results.min_kb = null;
		results.max_kb = null;

		if (data.attack.wbkb == 0) {
			//No WBKB moves
			results.percent = vs_mode ? (kb.vs_percent != null ? +kb.vs_percent.toFixed(6) : null) : (kb.training_percent != null ? +kb.training_percent.toFixed(6) : null);
		} else {
			//WBKB move
			if (vs_mode) {
				if (kb.rage_needed != -1) {
					results.attacker_percent = kb.vs_percent;
					results.rage_multiplier = kb.rage_needed;
					results.min_kb = +kb.wbkb_kb.toFixed(6);
					results.max_kb = (kb.wbkb_kb * 1.15).toFixed(6);
				} else {
					results.attacker_percent = null;
					results.min_kb = +kb.wbkb_kb.toFixed(6);
					results.max_kb = (kb.wbkb_kb * 1.15).toFixed(6);
				}
			} else {
				results.attacker_percent = null;
				results.min_kb = +kb.wbkb_kb.toFixed(6);
				results.max_kb = +kb.wbkb_kb.toFixed(6);
			}
			
		}

		

		res.json(results);
	}
	catch (err) {
		res.status(400).json({ message: "Error processing request" });
	}
}

function getDistance(data, target_percent) {
	var base_damage = data.attack.base_damage;
	var preLaunchDamage = data.attack.preLaunchDamage;

	if (data.attack.is_smash_attack) {
		base_damage = ChargeSmash(base_damage, data.attack.charged_frames, data.attack.mega_man_fsmash, data.attack.on_witch_time);
	}

	if (data.attack.chargeable) {
		if (data.attack.charge != null) {
			base_damage = data.attack.charge.formula(data.attack.base_damage, data.attack.bkb, data.attack.charged_frames)[0].toFixed(6);
			if (data.attack.charge.variable_bkb) {
				data.attack.bkb = data.attack.charge.formula(data.attack.base_damage, data.attack.bkb, data.attack.charged_frames)[1].toFixed(6);
			}
		}
	}

	if (data.attacker.name == "Lucario") {
		if (typeof data.attacker.aura != "undefined") {
			if (data.attacker.aura == null) {
				data.attacker.aura.stock_dif = "0";
				data.attacker.aura.game_mode = "Singles";
			}
		} else {
			data.attacker.aura = { stock_dif: "0", game_mode: "Singles" };
		}

		if (data.vs_mode) {
			base_damage *= Aura(data.attacker_percent, data.attacker.aura.stock_dif, data.attacker.aura.game_mode);
			preLaunchDamage *= Aura(data.attacker_percent, data.attacker.aura.stock_dif, data.attacker.aura.game_mode);
		} else {
			base_damage *= Aura(data.attacker_percent, "0", "Singles");
			preLaunchDamage *= Aura(data.attacker_percent, "0", "Singles");
		}

	}

	var damage = base_damage;
	damage *= data.attacker.modifier.damage_dealt;
	damage *= data.target.modifier.damage_taken;
	preLaunchDamage *= data.attacker.modifier.damage_dealt;
	preLaunchDamage *= data.target.modifier.damage_taken;
	var crouch = 1;
	var electric = "none";
	var r = 1;

	if (data.modifiers.crouch_cancel) {
		r = 0.85;
		crouch = 0.67;
	} else if (data.modifiers.interrupted_smash) {
		r = 1.2;
	}

	if (data.modifiers.electric_attack) {
		electric = "electric";
	}

	var di = data.modifiers.di;
	if (data.modifiers.no_di) {
		di = -1;
	}

	var windbox = data.attack.windbox;
	var is_projectile = data.attack.projectile;
	var ignoreStale = data.attack.ignore_staleness;

	var vs_mode = data.vs_mode;

	if (data.attack.wbkb == 0) {
		//No WBKB moves
		if (vs_mode) {
			kb = VSKB(target_percent + preLaunchDamage, base_damage, damage, data.attack.set_weight ? 100 : data.target.attributes.weight, data.attack.kbg, data.attack.bkb, data.target.attributes.gravity * data.target.modifier.gravity, data.target.attributes.fall_speed * data.target.modifier.fall_speed, r, data.attack.stale_queue, data.attack.ignore_staleness, data.attacker_percent, data.attack.angle, data.attack.aerial_opponent, data.attack.windbox, electric, di, data.modifiers.launch_rate);
		} else {
			kb = TrainingKB(target_percent + preLaunchDamage, base_damage, damage, data.attack.set_weight ? 100 : data.target.attributes.weight, data.attack.kbg, data.attack.bkb, data.target.attributes.gravity * data.target.modifier.gravity, data.target.attributes.fall_speed * data.target.modifier.fall_speed, r, data.attack.angle, data.attack.aerial_opponent, data.attack.windbox, electric, di, data.modifiers.launch_rate);
		}
		kb.addModifier(data.attacker.modifier.kb_dealt);
		kb.addModifier(data.target.modifier.kb_received);
	} else {
		//WBKB move
		if (vs_mode) {
			kb = WeightBasedKB(data.attack.set_weight ? 100 : data.target.attributes.weight, data.attack.bkb, data.attack.wbkb, data.attack.kbg, data.target.attributes.gravity * data.target.modifier.gravity, data.target.attributes.fall_speed * data.target.modifier.fall_speed, r, target_percent, damage, data.attacker_percent, data.attack.angle, data.attack.aerial_opponent, data.attack.windbox, electric, di, data.modifiers.launch_rate);
		} else {
			kb = WeightBasedKB(data.attack.set_weight ? 100 : data.target.attributes.weight, data.attack.bkb, data.attack.wbkb, data.attack.kbg, data.target.attributes.gravity * data.target.modifier.gravity, data.target.attributes.fall_speed * data.target.modifier.fall_speed, r, target_percent, damage, 0, data.attack.angle, data.attack.aerial_opponent, data.attack.windbox, electric, di, data.modifiers.launch_rate);
		}
		kb.addModifier(data.target.modifier.kb_received);
	}

	return new Distance(kb.kb, kb.horizontal_launch_speed, kb.vertical_launch_speed, kb.hitstun, kb.angle, kb.di_change, data.target.attributes.gravity * data.target.modifier.gravity, -1, data.target.attributes.fall_speed * data.target.modifier.fall_speed, data.target.attributes.traction * data.target.modifier.traction, data.stage.inverse_x, false, data.stage.position, data.stage.stage_data, true, 0);


}

function search(data, i, prev, n) {
	var found = false;
	var distance;
	var last;
	var target_percent = i;
	for (var x = i; x >= i - prev; x -= n) {
		last = x;
		target_percent = x - n;
		distance = getDistance(data, target_percent);
		if (!distance.KO) {
			return { "last": last, "distance": distance };
		}
	}
	return null;
}

function getKOPercent(data) {
	var result = {};
	var target_percent = 999;
	var distance = getDistance(data, target_percent);
	var last = 0;
	var found = false;
	if (distance.KO) {
		for (var i = 0; i <= 1000 && !found; i += 20) {
			if (i == 1000)
				i = 999;
			target_percent = i;
			distance = getDistance(data, target_percent);
			if (distance.KO) {
				if (i == 0) {
					result = { "ko": true, "ko_percent": 0, "distance": distance };
					found = true;
					break;
				}
				else {
					var t = search(data, i, 20, 5);
					if (t != null) {
						t = search(data, t.last, 5, 1);
						if (t != null) {
							t = search(data, t.last, 1, 0.5);
							if (t != null) {
								t = search(data, t.last, 0.5, 0.1);
								if (t != null) {
									t = search(data, t.last, 0.1, 0.02);
									result = { "ko": true, "ko_percent": t.last, "distance": t.distance };
									break;
								}
							}
						}
					}
				}
			}
		}
	} else {
		result = { "ko": false };
	}
	return result;
}

function calculateKOPercent(data, res) {
	try {
		var results = {};
		var r = getKOPercent(data);

		if (r.ko) {
			results.ko_percent = +r.ko_percent.toFixed(6);

		}
		else {
			results.ko_percent = null;
		}

		res.json(results);
	}
	catch (err) {
		res.status(400).json({ message: "Error processing request" });
	}
}

function calculateKOPercentBestDI(data, res) {
	try {
		var results = {};

		if (getKOPercent(data).ko) {

			data.modifiers.no_di = false;

			var list = [];

			for (var i = data.di_start; i < data.di_end; i+= data.di_step) {
				data.modifiers.di = i;

				var r = getKOPercent(data);

				if (r.ko) {

					list.push({ "di": i, "percent": +r.ko_percent.toFixed(6), "data": r });

				}
			}

			list.sort(function (a, b) {
				if (a.percent > b.percent) {
					return -1;
				} else if (a.percent < b.percent) {
					return 1;
				}
				return 0;
			});


			results.best_di = list[0].di;
			results.ko_percent = list[0].percent;

			results.calculations = [];

			for (var i = 0; i < list.length; i++) {
				results.calculations.push({
					di_angle: list[i].di,
					ko_percent: +list[i].percent.toFixed(6)
				});
			}

		} else {
			results.best_di = null;
			results.ko_percent = null;
		}

		res.json(results);
	}
	catch (err) {
		res.status(400).json({ message: "Error processing request" });
	}
}

exports.Character = Character;
exports.Modifier = Modifier;
exports.Knockback = Knockback;
exports.PercentFromKnockback = PercentFromKnockback;
exports.Collision = Collision;
exports.Distance = Distance;
exports.parameters = parameters;
exports.characters = characters;
exports.names = names;
exports.gameNames = gameNames;
exports.KHcharacters = KHcharacters;
exports.KBModifier = KBModifier;
exports.HitlagCrouch = HitlagCrouch;
exports.HitlagElectric = HitlagElectric;
exports.stages = stages;
exports.process = process;
exports.calculate = calculate;
exports.calculatePercentFromKB = calculatePercentFromKB;
exports.calculateKOPercent = calculateKOPercent;
exports.calculateKOPercentBestDI = calculateKOPercentBestDI;
exports.processMoveData = processMoveData;
exports.calculateShieldAdvantage = calculateShieldAdvantage;