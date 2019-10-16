$(document).ready( function () {
    var table;
    var tableData = [];
    // Not ideal to have this here :)
    var apiKey = "c4a9f4aa6c864ad985b4d44b14ff7076";

    function parseTrack(stopId) {
        // Stop ID is of form e.g. "South Station" or "South Station-04".
        // Return null if there is no track in the Stop ID.
        var trackRegex = /(\d+)$/;
        var match = stopId.match(trackRegex);
        if (match) {
            return match[0];
        } else {
            return null;
        }
    }

    function parseStation(stopId) {
        // Stop ID is of form e.g. "South Station" or "South Station-04".
        return stopId.split("-")[0];
    }

    function formatPrediction(prediction) {
        var formattedData = {};
        formattedData["id"] = prediction.id;
        formattedData["departure_station"] = parseStation(prediction.relationships.stop.data.id);
        formattedData["departure_time"] = moment(prediction.attributes.departure_time).format("LT");
        formattedData["status"] = prediction.attributes.status;
        formattedData["track"] = parseTrack(prediction.relationships.stop.data.id) || "TBD";

        $.ajax({
          url: `https://api-v3.mbta.com/trips/${prediction.relationships.trip.data.id}?api_key=${apiKey}`,
          dataType: 'json',
          async: false,
          success: data => {
            formattedData["destination"] = data.data.attributes.headsign;
         }
        });

        return formattedData;
    }

    function upsertPrediction(data, newPrediction) {
        var i = data.findIndex(currentPrediction => currentPrediction.id == newPrediction.id);
        if (i > -1) {
            data[i] = newPrediction;
        } else {
            data.push(newPrediction);
        }

        return data;
    }

    function removePrediction(data, predictionToDeleteId) {
        var i = data.findIndex(currentPrediction => currentPrediction.id == predictionToDeleteId);
        if (i > -1) {
            data.splice(i, 1);
        }

        return data;
    }

    function refreshTable(data) {
        if (table) {
            table.fnDestroy();
        }
        table = $('#departureBoard').dataTable({
            info: false,
            searching: false,
            paging: false,
            data: data,
            columns: [
                { data: 'departure_time' },
                { data: 'departure_station' },
                { data: 'destination' },
                { data: 'track' },
                { data: 'status' }
            ]
        });
    }

    var southStationId = "place-sstat";
    var northStationId = "place-north";
    var firstStationInRoute = 1;
    var commuterRailRouteType = 2;
    var limit = 10;
    var sortBy = "departure_time";
    var predictionsEventSource = new EventSource(`https://api-v3.mbta.com/predictions/?api_key=${apiKey}&filter[stop]=${southStationId},${northStationId}&stop_sequence=${firstStationInRoute}&filter[route_type]=${commuterRailRouteType}&page[limit]=${limit}&sort=${sortBy}`);

    predictionsEventSource.addEventListener("reset", event => {
        data = JSON.parse(event.data);

        tableData = data.map(prediction => {
           return formatPrediction(prediction);
        });

        refreshTable(tableData);
    });

    predictionsEventSource.addEventListener("update", event => {
            data = JSON.parse(event.data);
            tableData = upsertPrediction(tableData, formatPrediction(data));
            refreshTable(tableData);
    });

    predictionsEventSource.addEventListener("add", event => {
            data = JSON.parse(event.data);
            tableData = upsertPrediction(tableData, formatPrediction(data));
            refreshTable(tableData);
    });

    predictionsEventSource.addEventListener("remove", event => {
            data = JSON.parse(event.data);
            tableData = removePrediction(tableData, data.id);
            refreshTable(tableData);
    });
} );
