var GPSTrack = Thorax.Model.extend({
    saveState: function() {
        var attrs = this.attributes;
        return {
            title: attrs.title,
            id: attrs.id
        }
    }
});

var GPSTrackCollection = Thorax.Collection.extend({
    model: GPSTrack,
    saveState: function() {
        return this.map(function(track) {
            return track.saveState();
        });
    }
});

var GPSTrackView = Thorax.View.extend({
    template: Handlebars.compile(
        '<div class="track-item" title="{{title}}">{{title}}</div>' +
        '<input class="track-input">'
    ),
    events: {
        "click .track-item": function() {
            this._toggleViewMode();
            this.$el.find('.track-input').val(this.model.get('title')).focus();
        },
        "keypress .track-input": function(event) {
            if (event.which !== 13) {
                return;
            }

            var title = this.$el.find('.track-input').val();
            this.model.set('title', title);
        }
    },
    _toggleViewMode: function() {
        this.$el.find('.track-item').toggle();
        this.$el.find('.track-input').toggle();
    }
});

var GPSTrackCollectionView = Thorax.CollectionView.extend({
    itemView: GPSTrackView
});

var MapGPSTracksManager = function(map, collection) {
    this._map = map;
    this._collection = collection;
    collection.on('add', function(model) {
        L.geoJson(model.get('geojson')).addTo(this._map);
    }, this);
}
