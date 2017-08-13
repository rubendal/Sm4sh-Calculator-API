'use strict';
var express = require('express');
var router = express.Router();

var calculator = require('../calculator/calculator');
var kh = require('../calculator/khapi');

var exampleJsonRequest = {
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
		base_damage: 5.5,
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
		aerial_opponent: false,
		ignore_staleness: false,
		mega_man_fsmash: false,
		on_witch_time: false,
		unblockable: false,
		stale_queue: [false, false, false, false, false, false, false, false, false],
		effect: null
	},
	modifiers: {
		di: 0,
		no_di: false,
		launch_rate: 1,
		grounded_meteor: false,
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
		stage_data: null,
		position: { x: 0, y: 0 },
		inverse_x: false
	},
	vs_mode: true
};


////Respond with default request json
//router.get('/', function (req, res) {
//	res.json(exampleJsonRequest);
//});

router.get('/requestExample', function (req, res) {
	res.json(exampleJsonRequest);
});

//Respond with character names
router.get('/characters/names', function (req, res) {
	try {
		res.json(calculator.names);
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

//Respond with character attributes
router.get('/characters/:name', function (req, res) {
	try {
		var character = new calculator.Character(req.params.name);
		res.json(character.attributes);
	} catch (err) {
		res.status(500).json({
			message: "Error: Couldn't process request"
		});
		console.log(err);
	}
});

//Respond with character modifier list
router.get('/characters/:name/modifiers', function (req, res) {
	try {
		var character = new calculator.Character(req.params.name);
		res.json(character.modifiers);
	} catch (err) {
		res.status(500).json({
			message: "Error: Couldn't process request"
		});
		console.log(err);
	}
});

//Respond with character modifier name list
router.get('/characters/:name/modifiers/names', function (req, res) {
	try {
		var character = new calculator.Character(req.params.name);
		var names = [];
		for (var i = 0; i < character.modifiers.length; i++) {
			names.push(character.modifiers[i].name);
		}
		res.json(names);
	} catch (err) {
		res.status(500).json({
			message: "Error: Couldn't process request"
		});
		console.log(err);
	}
});

router.get('/stages', function (req, res) {
	try {
		res.json(calculator.stages);
	} catch (err) {
		res.status(500).json({
			message: "Error: Couldn't process request"
		});
	}
});

router.get('/stages/names', function (req, res) {
	try {
		var names = [];
		for (var i = 0; i < calculator.stages.length; i++) {
			names.push(calculator.stages[i].stage);
		}
		res.json(names);
	} catch (err) {
		res.status(500).json({
			message: "Error: Couldn't process request"
		});
	}
});

router.get('/stages/:name', function (req, res) {
	try {
		var data = null;
		for (var i = 0; i < calculator.stages.length; i++) {
			if (calculator.stages[i].stage == req.params.name) {
				data = calculator.stages[i];
				break;
			}
		}
		if (data != null) {
			res.json(data);
		} else {
			res.status(400).json({
				message: "Error: Stage not found"
			});
		}
	} catch (err) {
		res.status(500).json({
			message: "Error: Couldn't process request"
		});
	}
});

router.get('/moves', function (req, res) {
	kh.getMoves(function (data) {
		if (data != null) {
			res.json(data);
		} else {
			kh.getMovesFromLocalFiles(function (localData) {
				if (localData != null) {
					res.json(localData);
				} else {
					res.status(500).json({
						message: "Error: Unable to get move data"
					});
				}
			});
		}
	});
});

router.get('/moves/effects', function (req, res) {
	res.json(calculator.effects);
});

router.get('/moves/:name/names', function (req, res) {
	var character = new calculator.Character(req.params.name);
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
	var character = new calculator.Character(req.params.name);
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
	if (!isNaN(parseFloat(req.params.api_id)) && isFinite(req.params.api_id)) {
		try {
			kh.getMove(parseInt(req.params.api_id), function (data) {
				if (data != null) {
					for (var i = 0; i < data.length; i++) {
						delete data[i].charge;
					}
					res.json(data);
				}
				else {
					kh.getMoveFromLocalFiles(req.params.api_id, function (localData) {
						if (localData != null) {
							for (var i = 0; i < localData.length; i++) {
								delete localData[i].charge;
							}
							res.json(localData);
						} else {
							res.status(500).json({
								message: "Error: Invalid id"
							});
						}
					});
				}
			});
		} catch (err) {
			res.status(500).json({
				message: "Error: Move not found"
			});
		}
	} else {
		res.status(500).json({
			message: "Error: Requested id is not a number"
		});
	} 
});



router.post('/calculate/kb', function (req, res) {
	var processedData = calculator.process(req.body, res);

	if (processedData == null)
		return;
	if (typeof processedData.attack.name != undefined) {
		if (processedData.attack.name != null) {

			kh.getMoveset(processedData.attacker.api_name, function (data) {
				if (data != null) {
					calculator.processMoveData(processedData, data);
					calculator.calculate(processedData, res);
				} else {
					kh.getMovesetFromLocalFiles(processedData.attacker.api_name, function (localData) {
						if (localData != null) {
							calculator.processMoveData(processedData, localData);
							calculator.calculate(processedData, res);
						} else {
							res.status(500).json({
								message: "Error: Move name not found"
							});
						}
					});
				}
			});
		} else {
			calculator.calculate(processedData, res);
		}
	} else {
		calculator.calculate(processedData, res);
	}
});

router.post('/calculate/shieldadvantage', function (req, res) {
	var processedData = calculator.process(req.body, res);

	if (processedData == null)
		return;
	if (typeof processedData.attack.name != undefined) {
		if (processedData.attack.name != null) {

			kh.getMoveset(processedData.attacker.api_name, function (data) {
				if (data != null) {
					calculator.processMoveData(processedData, data);
					calculator.calculateShieldAdvantage(processedData, res);
				} else {
					kh.getMovesetFromLocalFiles(processedData.attacker.api_name, function (localData) {
						if (localData != null) {
							calculator.processMoveData(processedData, localData);
							calculator.calculateShieldAdvantage(processedData, res);
						} else {
							res.status(500).json({
								message: "Error: Move name not found"
							});
						}
					});
				}
			});
		} else {
			calculator.calculate(processedData, res);
		}
	} else {
		calculator.calculate(processedData, res);
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

	var processedData = calculator.process(req.body, res);

	if (processedData == null)
		return;

	processedData.kb = req.body.kb;

	if (typeof processedData.attack.name != undefined) {
		if (processedData.attack.name != null) {

			kh.getMoveset(processedData.attacker.api_name, function (data) {
				if (data != null) {
					calculator.processMoveData(processedData, data);
					calculator.calculatePercentFromKB(processedData, res);
				} else {
					kh.getMovesetFromLocalFiles(processedData.attacker.api_name, function (localData) {
						if (localData != null) {
							calculator.processMoveData(processedData, localData);
							calculator.calculatePercentFromKB(processedData, res);
						} else {
							res.status(500).json({
								message: "Error: Move name not found"
							});
						}
					});
				}
			});
		} else {
			calculator.calculatePercentFromKB(processedData, res);
		}
	} else {
		calculator.calculatePercentFromKB(processedData, res);
	}
});

router.post('/calculate/kopercent', function (req, res) {
	var processedData = calculator.process(req.body, res);

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
					calculator.processMoveData(processedData, data);
					calculator.calculateKOPercent(processedData, res);
				} else {
					kh.getMovesetFromLocalFiles(processedData.attacker.api_name, function (localData) {
						if (localData != null) {
							calculator.processMoveData(processedData, localData);
							calculator.calculateKOPercent(processedData, res);
						} else {
							res.status(500).json({
								message: "Error: Move name not found"
							});
						}
					});
				}
			});
		} else {
			calculator.calculateKOPercent(processedData, res);
		}
	} else {
		calculator.calculateKOPercent(processedData, res);
	}
});

router.post('/calculate/kopercent/bestdi', function (req, res) {
	var processedData = calculator.process(req.body, res);

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
					calculator.processMoveData(processedData, data);
					calculator.calculateKOPercentBestDI(processedData, res);
				} else {
					kh.getMovesetFromLocalFiles(processedData.attacker.api_name, function (localData) {
						if (localData != null) {
							calculator.processMoveData(processedData, localData);
							calculator.calculateKOPercentBestDI(processedData, res);
						} else {
							res.status(500).json({
								message: "Error: Move name not found"
							});
						}
					});
				}
			});
		} else {
			calculator.calculateKOPercentBestDI(processedData, res);
		}
	} else {
		calculator.calculateKOPercentBestDI(processedData, res);
	}
});

//All other requests for paths that don't exist
router.all('*', function (req, res) {
	res.status(404).json({
		message: "Error: No resource available under the requested URI " + req.protocol + '://' + req.get('host') + req.originalUrl
	});
});



module.exports = router;
