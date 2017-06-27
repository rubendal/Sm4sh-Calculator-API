'use strict';
var express = require('express');
var router = express.Router();

var global = require('../calculator/global');
var kh = require('../calculator/khapi');

var exampleJsonRequest = {
	kb: 80,
	best_di: false,
	attacker: {
		character: "Mario",
		character_id: 27,
		modifier: "Normal",
		percent: 0,
		damage_dealt: 1,
		kb_dealt: 1,
		aura: {
			stock_dif: "0",
			game_mode: "Singles"
		}
	},
	target: {
		character: "Mario",
		character_id: 27,
		modifier: "Normal",
		percent: 0,
		weight: 100,
		damage_taken: 1,
		kb_received: 1,
		gravity: 0.075,
		fall_speed: 0.1,
		traction: 0.1,
		luma_percent: 0
	},
	attack: {
		name: null,
		damage: 5.5,
		hitlag: 1,
		angle: 96,
		bkb: 28,
		wbkb: 0,
		kbg: 130,
		shield_damage: 0,
		preLaunchDamage: 0,
		is_smash_attack: false,
		charged_frames: 0,
		windbox: false,
		projectile: false,
		set_weight: false,
		paralyzer: false,
		aerial_opponent: false,
		ignore_staleness: false,
		mega_man_fsmash: false,
		on_witch_time: false,
		unblockable: false,
		stale_queue: [false, false, false, false, false, false, false, false, false]
	},
	modifiers: {
		di: 0,
		no_di: false,
		launch_rate: 1,
		grounded_meteor: false,
		electric_attack: false,
		crouch_cancel: false,
		interrupted_smash_charge: false
	},
	shield_advantage: {
		hit_frame: 5,
		faf: 30,
		powershield: false
	},
	stage: {
		name: null,
		stage_data: null, //use custom stage data!
		position: { x: 0, y: 0 },
		inverse_x: false
	},
	vs_mode: true
};


////Respond with default request json
//router.get('/', function (req, res) {
//	res.json(exampleJsonRequest);
//});

//Respond with character names
router.get('/characters/names', function (req, res) {
	try {
		res.json(global.names);
	} catch (err) {
		res.status(500).json({
			message: "Error: Couldn't process request"
		});
	}
});

//Respond with character names and ids
router.get('/characters', function (req, res) {
	try {
		var json = [];
		for (var i = 0; i < kh.names.length; i++) {
			json.push({
				name: kh.names[i],
				id: kh.getCharacterIdFromKH(kh.names[i])
			});
		}
		res.json(json);
	} catch (err) {
		res.status(500).json({
			message: "Error: Couldn't process request"
		});
	}
});

router.get('/stages', function (req, res) {
	try {
		res.json(global.stages);
	} catch (err) {
		res.status(500).json({
			message: "Error: Couldn't process request"
		});
	}
});

router.get('/stages/names', function (req, res) {
	try {
		var names = [];
		for (var i = 0; i < global.stages.length; i++) {
			names.push(global.stages[i].stage);
		}
		res.json(names);
	} catch (err) {
		res.status(500).json({
			message: "Error: Couldn't process request"
		});
	}
});

router.get('/moves/:name/names', function (req, res) {
	var character = new global.Character(req.params.name);
	kh.getMoveset(character.api_name, function (data) {
		if (data != null) {
			var names = [];
			for (var i = 0; i < data.length; i++) {
				names.push(data[i].name);
			}
			res.json(names);
		} else {
			kh.getMovesetFromLocalFiles(character.api_name, function (localData) {
				if (localData != null) {
					var names = [];
					for (var i = 0; i < localData.length; i++) {
						names.push(localData[i].name);
					}
					res.json(names);
				} else {
					res.status(500).json({
						message: "Error: Invalid character"
					});
				}
			});
		}
	});
});

router.get('/moves/:name', function (req, res) {
	var character = new global.Character(req.params.name);
	kh.getMoveset(character.api_name, function (data) {
		if (data != null) {
			for (var i = 0; i < data.length; i++) {
				delete data[i].charge;
			}
			res.json(data);
		} else {
			kh.getMovesetFromLocalFiles(character.api_name, function (localData) {
				if (localData != null) {
					for (var i = 0; i < localData.length; i++) {
						delete localData[i].charge;
					}
					res.json(localData);
				} else {
					res.status(500).json({
						message: "Error: Invalid character"
					});
				}
			});
		}
	});
});

router.get('/moves/id/:api_id', function (req, res) {
	try {
		if (!isNaN(parseFloat(req.params.api_id)) && isFinite(req.params.api_id)) {
			try {
				kh.getMove(parseInt(req.params.api_id), function (data) {
					if (data != null) {
						delete data.charge;
						res.json(data);
					}
					else {
						res.status(500).json({
							message: "Error: Move not found or KH API isn't available"
						});
					}					
				});
			} catch (err) {
				res.status(500).json({
					message: "Error: Move not found or KH API isn't available"
				});
			}
		} else {
			res.status(500).json({
				message: "Error: Requested id is not a number"
			});
		} 
	} catch (err) {
		res.status(500).json({
			message: "Error: Invalid character id or KH API isn't available"
		});
	}
});

router.post('/calculate/kb', function (req, res) {
	var processedData = global.process(req.body, res);

	if (processedData == null)
		return;
	if (typeof processedData.attack.name != undefined) {
		if (processedData.attack.name != null) {

			kh.getMoveset(processedData.attacker.api_name, function (data) {
				if (data != null) {
					for (var i = 0; i < data.length; i++) {
						if (data[i].name == processedData.attack.name) {
							processedData.attack.base_damage = data[i].base_damage;
							processedData.attack.angle = data[i].angle;
							processedData.attack.bkb = data[i].bkb;
							processedData.attack.wbkb = data[i].wbkb;
							processedData.attack.kbg = data[i].kbg;
							processedData.attack.shield_damage = data[i].shieldDamage;
							processedData.attack.preLaunchDamage = data[i].preLaunchDamage;
							if (isNaN(processedData.attack.preLaunchDamage)) {
								processedData.attack.preLaunchDamage = 0;
							}
							processedData.attack.is_smash_attack = data[i].smash_attack;
							processedData.attack.chargeable = data[i].chargeable;
							processedData.attack.charge = data[i].charge;
							processedData.attack.unblockable = data[i].unblockable;
							processedData.attack.windbox = data[i].windbox;
							processedData.attack.landingLag = data[i].landingLag;
							processedData.attack.autoCancel = data[i].autoCancel;
							if (processedData.shield_advantage.hit_frame == null) {
								if (data[i].hitboxActive.length > 0) {
									processedData.shield_advantage.hit_frame = data[i].hitboxActive[0].start;
								}
							}
							if (processedData.shield_advantage.faf == null) {
								processedData.shield_advantage.faf = data[i].faf;
							}
							break;
						}
					}
					global.calculate(processedData, res);
				} else {
					kh.getMovesetFromLocalFiles(processedData.attacker.api_name, function (localData) {
						if (localData != null) {
							for (var i = 0; i < localData.length; i++) {
								if (localData[i].name == processedData.attack.name) {
									processedData.attack.base_damage = localData[i].base_damage;
									processedData.attack.angle = localData[i].angle;
									processedData.attack.bkb = localData[i].bkb;
									processedData.attack.wbkb = localData[i].wbkb;
									processedData.attack.kbg = localData[i].kbg;
									processedData.attack.shield_damage = localData[i].shieldDamage;
									processedData.attack.preLaunchDamage = localData[i].preLaunchDamage;
									if (isNaN(processedData.attack.preLaunchDamage)) {
										processedData.attack.preLaunchDamage = 0;
									}
									processedData.attack.is_smash_attack = localData[i].smash_attack;
									processedData.attack.chargeable = localData[i].chargeable;
									processedData.attack.charge = localData[i].charge;
									processedData.attack.unblockable = localData[i].unblockable;
									processedData.attack.windbox = localData[i].windbox;
									processedData.attack.landingLag = localData[i].landingLag;
									processedData.attack.autoCancel = localData[i].autoCancel;
									if (processedData.shield_advantage.hit_frame == null) {
										if (localData[i].hitboxActive.length > 0) {
											processedData.shield_advantage.hit_frame = localData[i].hitboxActive[0].start;
										}
									}
									if (processedData.shield_advantage.faf == null) {
										processedData.shield_advantage.faf = localData[i].faf;
									}
									break;
								}
							}
							global.calculate(processedData, res);
						} else {
							res.status(500).json({
								message: "Error: Move name not found"
							});
						}
					});
				}
			});
		} else {
			global.calculate(processedData, res);
		}
	} else {
		global.calculate(processedData, res);
	}
});


router.post('/calculate/percentfromkb', function (req, res) {
	if (typeof req.body.kb == "undefined")
		req.body.kb = null;

	if (req.body.kb == null) {
		res.status(400).json({
			message: "Error: Missing kb"
		});
		return;
	}

	var processedData = global.process(req.body, res);

	if (processedData == null)
		return;

	processedData.kb = req.body.kb;

	if (typeof processedData.attack.name != undefined) {
		if (processedData.attack.name != null) {

			kh.getMoveset(processedData.attacker.api_name, function (data) {
				if (data != null) {
					for (var i = 0; i < data.length; i++) {
						if (data[i].name == processedData.attack.name) {
							processedData.attack.base_damage = data[i].base_damage;
							processedData.attack.angle = data[i].angle;
							processedData.attack.bkb = data[i].bkb;
							processedData.attack.wbkb = data[i].wbkb;
							processedData.attack.kbg = data[i].kbg;
							processedData.attack.shield_damage = data[i].shieldDamage;
							processedData.attack.preLaunchDamage = data[i].preLaunchDamage;
							if (isNaN(processedData.attack.preLaunchDamage)) {
								processedData.attack.preLaunchDamage = 0;
							}
							processedData.attack.is_smash_attack = data[i].smash_attack;
							processedData.attack.chargeable = data[i].chargeable;
							processedData.attack.charge = data[i].charge;
							processedData.attack.unblockable = data[i].unblockable;
							processedData.attack.windbox = data[i].windbox;
							processedData.attack.landingLag = data[i].landingLag;
							processedData.attack.autoCancel = data[i].autoCancel;
							if (processedData.shield_advantage.hit_frame == null) {
								if (data[i].hitboxActive.length > 0) {
									processedData.shield_advantage.hit_frame = data[i].hitboxActive[0].start;
								}
							}
							if (processedData.shield_advantage.faf == null) {
								processedData.shield_advantage.faf = data[i].faf;
							}
							break;
						}
					}
					global.calculatePercentFromKB(processedData, res);
				} else {
					kh.getMovesetFromLocalFiles(processedData.attacker.api_name, function (localData) {
						if (localData != null) {
							for (var i = 0; i < localData.length; i++) {
								if (localData[i].name == processedData.attack.name) {
									processedData.attack.base_damage = localData[i].base_damage;
									processedData.attack.angle = localData[i].angle;
									processedData.attack.bkb = localData[i].bkb;
									processedData.attack.wbkb = localData[i].wbkb;
									processedData.attack.kbg = localData[i].kbg;
									processedData.attack.shield_damage = localData[i].shieldDamage;
									processedData.attack.preLaunchDamage = localData[i].preLaunchDamage;
									if (isNaN(processedData.attack.preLaunchDamage)) {
										processedData.attack.preLaunchDamage = 0;
									}
									processedData.attack.is_smash_attack = localData[i].smash_attack;
									processedData.attack.chargeable = localData[i].chargeable;
									processedData.attack.charge = localData[i].charge;
									processedData.attack.unblockable = localData[i].unblockable;
									processedData.attack.windbox = localData[i].windbox;
									processedData.attack.landingLag = localData[i].landingLag;
									processedData.attack.autoCancel = localData[i].autoCancel;
									if (processedData.shield_advantage.hit_frame == null) {
										if (localData[i].hitboxActive.length > 0) {
											processedData.shield_advantage.hit_frame = localData[i].hitboxActive[0].start;
										}
									}
									if (processedData.shield_advantage.faf == null) {
										processedData.shield_advantage.faf = localData[i].faf;
									}
									break;
								}
							}
							global.calculatePercentFromKB(processedData, res);
						} else {
							res.status(500).json({
								message: "Error: Move name not found"
							});
						}
					});
				}
			});
		} else {
			global.calculatePercentFromKB(processedData, res);
		}
	} else {
		global.calculatePercentFromKB(processedData, res);
	}
});

router.post('/calculate/kopercent', function (req, res) {
	var processedData = global.process(req.body, res);

	if (processedData == null)
		return;

	if (processedData.stage.stage_data == null) {
		res.status(400).json({
			message: "Error: No stage data selected to calculate KO percent"
		});
		return;
	}
	
	if (typeof processedData.attack.name != undefined) {
		if (processedData.attack.name != null) {

			kh.getMoveset(processedData.attacker.api_name, function (data) {
				if (data != null) {
					for (var i = 0; i < data.length; i++) {
						if (data[i].name == processedData.attack.name) {
							processedData.attack.base_damage = data[i].base_damage;
							processedData.attack.angle = data[i].angle;
							processedData.attack.bkb = data[i].bkb;
							processedData.attack.wbkb = data[i].wbkb;
							processedData.attack.kbg = data[i].kbg;
							processedData.attack.shield_damage = data[i].shieldDamage;
							processedData.attack.preLaunchDamage = data[i].preLaunchDamage;
							if (isNaN(processedData.attack.preLaunchDamage)) {
								processedData.attack.preLaunchDamage = 0;
							}
							processedData.attack.is_smash_attack = data[i].smash_attack;
							processedData.attack.chargeable = data[i].chargeable;
							processedData.attack.charge = data[i].charge;
							processedData.attack.unblockable = data[i].unblockable;
							processedData.attack.windbox = data[i].windbox;
							processedData.attack.landingLag = data[i].landingLag;
							processedData.attack.autoCancel = data[i].autoCancel;
							if (processedData.shield_advantage.hit_frame == null) {
								if (data[i].hitboxActive.length > 0) {
									processedData.shield_advantage.hit_frame = data[i].hitboxActive[0].start;
								}
							}
							if (processedData.shield_advantage.faf == null) {
								processedData.shield_advantage.faf = data[i].faf;
							}
							break;
						}
					}
					global.calculateKOPercent(processedData, res);
				} else {
					kh.getMovesetFromLocalFiles(processedData.attacker.api_name, function (localData) {
						if (localData != null) {
							for (var i = 0; i < localData.length; i++) {
								if (localData[i].name == processedData.attack.name) {
									processedData.attack.base_damage = localData[i].base_damage;
									processedData.attack.angle = localData[i].angle;
									processedData.attack.bkb = localData[i].bkb;
									processedData.attack.wbkb = localData[i].wbkb;
									processedData.attack.kbg = localData[i].kbg;
									processedData.attack.shield_damage = localData[i].shieldDamage;
									processedData.attack.preLaunchDamage = localData[i].preLaunchDamage;
									if (isNaN(processedData.attack.preLaunchDamage)) {
										processedData.attack.preLaunchDamage = 0;
									}
									processedData.attack.is_smash_attack = localData[i].smash_attack;
									processedData.attack.chargeable = localData[i].chargeable;
									processedData.attack.charge = localData[i].charge;
									processedData.attack.unblockable = localData[i].unblockable;
									processedData.attack.windbox = localData[i].windbox;
									processedData.attack.landingLag = localData[i].landingLag;
									processedData.attack.autoCancel = localData[i].autoCancel;
									if (processedData.shield_advantage.hit_frame == null) {
										if (localData[i].hitboxActive.length > 0) {
											processedData.shield_advantage.hit_frame = localData[i].hitboxActive[0].start;
										}
									}
									if (processedData.shield_advantage.faf == null) {
										processedData.shield_advantage.faf = localData[i].faf;
									}
									break;
								}
							}
							global.calculateKOPercent(processedData, res);
						} else {
							res.status(500).json({
								message: "Error: Move name not found"
							});
						}
					});
				}
			});
		} else {
			global.calculateKOPercent(processedData, res);
		}
	} else {
		global.calculateKOPercent(processedData, res);
	}
});

router.post('/calculate/kopercent/bestdi', function (req, res) {
	var processedData = global.process(req.body, res);

	if (processedData == null)
		return;

	if (typeof req.body.di_start == "undefined")
		req.body.di_start = null;

	if (req.body.di_start == null)
		req.body.di_start = 0;

	if (req.body.di_start < 0)
		req.body.di_start = 0;

	if (typeof req.body.di_end == "undefined")
		req.body.di_end = null;

	if (req.body.di_end == null)
		req.body.di_end = 360;

	if (req.body.di_end > 360)
		req.body.di_end = 360;

	if (typeof req.body.di_step == "undefined")
		req.body.di_step = null;

	if (req.body.di_step == null)
		req.body.di_step = 30;

	if (req.body.di_step < 1)
		req.body.di_step = 1;

	if (req.body.di_step > 90)
		req.body.di_step = 90;


	processedData.di_start = req.body.di_start;
	processedData.di_end = req.body.di_end;
	processedData.di_step = req.body.di_step;

	if (processedData.stage.stage_data == null) {
		res.status(400).json({
			message: "Error: No stage data selected to calculate KO percent"
		});
		return;
	}

	if (typeof processedData.attack.name != undefined) {
		if (processedData.attack.name != null) {

			kh.getMoveset(processedData.attacker.api_name, function (data) {
				if (data != null) {
					for (var i = 0; i < data.length; i++) {
						if (data[i].name == processedData.attack.name) {
							processedData.attack.base_damage = data[i].base_damage;
							processedData.attack.angle = data[i].angle;
							processedData.attack.bkb = data[i].bkb;
							processedData.attack.wbkb = data[i].wbkb;
							processedData.attack.kbg = data[i].kbg;
							processedData.attack.shield_damage = data[i].shieldDamage;
							processedData.attack.preLaunchDamage = data[i].preLaunchDamage;
							if (isNaN(processedData.attack.preLaunchDamage)) {
								processedData.attack.preLaunchDamage = 0;
							}
							processedData.attack.is_smash_attack = data[i].smash_attack;
							processedData.attack.chargeable = data[i].chargeable;
							processedData.attack.charge = data[i].charge;
							processedData.attack.unblockable = data[i].unblockable;
							processedData.attack.windbox = data[i].windbox;
							processedData.attack.landingLag = data[i].landingLag;
							processedData.attack.autoCancel = data[i].autoCancel;
							if (processedData.shield_advantage.hit_frame == null) {
								if (data[i].hitboxActive.length > 0) {
									processedData.shield_advantage.hit_frame = data[i].hitboxActive[0].start;
								}
							}
							if (processedData.shield_advantage.faf == null) {
								processedData.shield_advantage.faf = data[i].faf;
							}
							break;
						}
					}
					global.calculateKOPercentBestDI(processedData, res);
				} else {
					kh.getMovesetFromLocalFiles(processedData.attacker.api_name, function (localData) {
						if (localData != null) {
							for (var i = 0; i < localData.length; i++) {
								if (localData[i].name == processedData.attack.name) {
									processedData.attack.base_damage = localData[i].base_damage;
									processedData.attack.angle = localData[i].angle;
									processedData.attack.bkb = localData[i].bkb;
									processedData.attack.wbkb = localData[i].wbkb;
									processedData.attack.kbg = localData[i].kbg;
									processedData.attack.shield_damage = localData[i].shieldDamage;
									processedData.attack.preLaunchDamage = localData[i].preLaunchDamage;
									if (isNaN(processedData.attack.preLaunchDamage)) {
										processedData.attack.preLaunchDamage = 0;
									}
									processedData.attack.is_smash_attack = localData[i].smash_attack;
									processedData.attack.chargeable = localData[i].chargeable;
									processedData.attack.charge = localData[i].charge;
									processedData.attack.unblockable = localData[i].unblockable;
									processedData.attack.windbox = localData[i].windbox;
									processedData.attack.landingLag = localData[i].landingLag;
									processedData.attack.autoCancel = localData[i].autoCancel;
									if (processedData.shield_advantage.hit_frame == null) {
										if (localData[i].hitboxActive.length > 0) {
											processedData.shield_advantage.hit_frame = localData[i].hitboxActive[0].start;
										}
									}
									if (processedData.shield_advantage.faf == null) {
										processedData.shield_advantage.faf = localData[i].faf;
									}
									break;
								}
							}
							global.calculateKOPercentBestDI(processedData, res);
						} else {
							res.status(500).json({
								message: "Error: Move name not found"
							});
						}
					});
				}
			});
		} else {
			global.calculateKOPercentBestDI(processedData, res);
		}
	} else {
		global.calculateKOPercentBestDI(processedData, res);
	}
});

//All other requests for paths that don't exist
router.all('*', function (req, res) {
	res.status(404).json({
		message: "Error: No resource available under the requested URI " + req.protocol + '://' + req.get('host') + req.originalUrl
	});
});



module.exports = router;
