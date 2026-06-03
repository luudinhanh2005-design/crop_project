// explore_services.js
window.AgriExplore = window.AgriExplore || {};

(function() {
    let activeSearchController = null;
    const cropCache = new Map();

    window.AgriExplore.searchService = {
        search: async function(query, page = 1, limit = 10) {
            if (activeSearchController) activeSearchController.abort();
            activeSearchController = new AbortController();
            
            try {
                const res = await fetch(`/api/explore/search?q=${encodeURIComponent(query)}&page=${page}&limit=${limit}`, {
                    signal: activeSearchController.signal
                });
                if (!res.ok) throw new Error("Search request failed");
                return await res.json();
            } catch (err) {
                if (err.name === 'AbortError') return null;
                console.error('Search Service Error:', err);
                throw err;
            }
        }
    };

    window.AgriExplore.cropService = {
        getTrendingCrops: async function() {
            try {
                const res = await fetch('/api/explore/trending-crops');
                if (!res.ok) throw new Error();
                const json = await res.json();
                return json.success ? json.data : [];
            } catch (err) {
                console.error("Trending Crops Fetch Error:", err);
                return [];
            }
        },

        getCropDetails: async function(cropName) {
            if (cropCache.has(cropName)) return cropCache.get(cropName);
            
            const res = await fetch(`/api/explore/crops/${encodeURIComponent(cropName)}`);
            if (!res.ok) throw new Error("Crop not found");
            const result = await res.json();
            if (result.success && result.data) {
                cropCache.set(cropName, result.data);
                return result.data;
            }
            throw new Error(result.error || 'Crop not found');
        },

        getAIAnalysis: async function(cropName, temp, humidity, region) {
            const url = `/api/explore/ai-analysis/${encodeURIComponent(cropName)}?temp=${temp}&humidity=${humidity}&region=${encodeURIComponent(region)}`;
            const res = await fetch(url);
            if (!res.ok) throw new Error("AI analysis request failed");
            const result = await res.json();
            return result.success ? result.analysis : null;
        }
    };

    window.AgriExplore.newsService = {
        getHeroNews: async function() {
            try {
                const res = await fetch('/api/explore/hero-news');
                if (!res.ok) throw new Error();
                const json = await res.json();
                return json.success ? json.data : [];
            } catch (err) {
                console.error("Hero News Fetch Error:", err);
                return [];
            }
        }
    };

    window.AgriExplore.calendarService = {
        getSeasonalCalendar: async function(month, region) {
            try {
                const res = await fetch(`/api/explore/seasonal-calendar?month=${month}&region=${encodeURIComponent(region)}`);
                if (!res.ok) throw new Error();
                const json = await res.json();
                return json.success ? json.data : null;
            } catch (err) {
                console.error("Seasonal Calendar Fetch Error:", err);
                return null;
            }
        }
    };

    window.AgriExplore.mapService = {
        getMapData: async function() {
            try {
                const res = await fetch('/api/explore/map-data');
                if (!res.ok) throw new Error();
                const json = await res.json();
                return json.success ? json.regions : [];
            } catch (err) {
                console.error("Map Data Fetch Error:", err);
                return [];
            }
        }
    };

    window.AgriExplore.weatherService = {
        getWeather: async function(lat = 10.0, lon = 106.0) {
            try {
                const res = await fetch(`/api/weather?lat=${lat}&lon=${lon}`);
                if (res.ok) {
                    const json = await res.json();
                    if (json.success) return json;
                }
                throw new Error();
            } catch {
                return {
                    success: true,
                    daily: {
                        temperature_2m_max: [28, 29, 30],
                        precipitation_sum: [0, 2, 0],
                        relative_humidity_2m_max: [70, 72, 75]
                    },
                    alerts: [{
                        type: "safe",
                        level: "safe",
                        icon: "☀️",
                        title: "Thời tiết Thuận lợi",
                        desc: "Điều kiện thời tiết tốt cho cây trồng phát triển"
                    }]
                };
            }
        }
    };
})();
