const assert = require('assert')

const sceneFields = [
    "scene_number",
    "synopsis",
    "time",
    "location",
    "set"
]

function sceneJson(data) {
    for (const field of sceneFields) {
        try {
            assert.ok(data.hasOwnProperty(field));
        } catch {
            throw new Error(`Received malformed script data with missing field: ${field}`)
        }
    }

    try {
        assert.ok(data.set.type, 'missing set type');
    } catch (error) {
        throw new Error(`Received malformed script data with scene ${data['scene_number']}: ${error.message}`)
    }

    try {
        if (data.elements['background_actors']) {
            for (const actor of data.elements['background_actors']) {
                for (const field of Object.keys(actor)) {
                    assert.ok(['name', 'age'].includes(field.toLowerCase()), field + ' is not a valid field for background actor');
                }
            }
        }
    } catch (error){
        throw new Error(`Received malformed script data with scene ${data['scene_number']}: ${error.message}`)
    }
}

module.exports = {sceneJson}