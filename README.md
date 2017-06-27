# Sm4sh-Calculator-API

Sm4sh Calculator functionality on a API on nodejs

API documentation can be found [here](http://calculator.kuroganehammer.com/swagger/ui/)

### Features

- Calculate KB, shield advantage and launch trajectory
- Calculate percent the opponent must have to obtain certain KB
- Calculate KO percent and best DI KO percent based on character, move, modifiers and stage data
- Get move data parsed from the KH API

### Updates

- Move data end frame is no longer 0 when move is active for 1 frame, instead it's the same as start
- The API uses local json files from the KH API that are used when KH API is down or giving error messages (except `/moves/id/{moveId}` which will be added when the KH API is back online)

### Issues and Feedback

As always feel free to open an issue here or tell me on Twitter or on Discord