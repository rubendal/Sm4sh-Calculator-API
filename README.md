# Sm4sh-Calculator-API

[Sm4sh Calculator](https://github.com/rubendal/Sm4sh-Calculator) functionality on an API on nodejs

API documentation can be found [here](http://calculator.kuroganehammer.com/swagger/ui/)

### Features

- Calculate KB, shield advantage and launch trajectory
- Calculate percent the opponent must have to obtain certain KB
- Calculate KO percent and best DI KO percent based on character, move, modifiers and stage data
- Request move data parsed from the KH API
- Request character/stage data

### Updates

- Move data end frame is no longer 0 when move is active for 1 frame, instead it's the same as start
- The API uses local json files from the KH API that are used when KH API is down or giving error messages
- Changed move autocancel data, > on KH is actually >=, changed rawValue to `&ge;`, type to ">=" and value is not reduced by 1
- Added calculate only shield advantage
- Added character attribute/modifier lists, stage data given by name and all moves list
- Added isFinishingTouch flag for set gravity/fall speed calculations with Finishing Touch
- Added Shield Pushback calculations
- Changed DI to use stick position values, can still send angle and the calculator will calculate the position closest to the stick gate that represents the given angle

### Issues and Feedback

As always feel free to open an issue here or tell me on Twitter or on Discord