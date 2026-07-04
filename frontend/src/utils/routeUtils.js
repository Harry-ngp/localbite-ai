export const generateAStarRoute = (sLat, sLng, eLat, eLng, gridSize = 20) => {
    const minLat = Math.min(sLat, eLat) - 0.002, maxLat = Math.max(sLat, eLat) + 0.002;
    const minLng = Math.min(sLng, eLng) - 0.002, maxLng = Math.max(sLng, eLng) + 0.002;
    const latStep = (maxLat - minLat) / gridSize, lngStep = (maxLng - minLng) / gridSize;

    const getPos = (lat, lng) => ({
        x: Math.min(gridSize - 1, Math.max(0, Math.round((lat - minLat) / latStep))),
        y: Math.min(gridSize - 1, Math.max(0, Math.round((lng - minLng) / lngStep)))
    });

    const start = getPos(sLat, sLng);
    const end = getPos(eLat, eLng);

    // Grid with random obstacles (20% blocked)
    const grid = Array(gridSize).fill(null).map(() => Array(gridSize).fill(0));
    for (let i = 0; i < gridSize * gridSize * 0.2; i++) {
        const ox = Math.floor(Math.random() * gridSize), oy = Math.floor(Math.random() * gridSize);
        if ((ox !== start.x || oy !== start.y) && (ox !== end.x || oy !== end.y)) grid[ox][oy] = 1;
    }

    const heuristic = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
    const openSet = [{ ...start, f: 0, g: 0, h: 0, parent: null }];
    const closedSet = new Set();
    let bestNode = openSet[0];

    while (openSet.length > 0) {
        openSet.sort((a, b) => a.f - b.f);
        const current = openSet.shift();

        if (current.x === end.x && current.y === end.y) { bestNode = current; break; }
        closedSet.add(`${current.x},${current.y}`);

        const neighbors = [[0, 1], [1, 0], [0, -1], [-1, 0]]
            .map(([dx, dy]) => ({ x: current.x + dx, y: current.y + dy }))
            .filter(n => n.x >= 0 && n.x < gridSize && n.y >= 0 && n.y < gridSize && grid[n.x][n.y] === 0);

        for (const neighbor of neighbors) {
            if (closedSet.has(`${neighbor.x},${neighbor.y}`)) continue;
            const tentative_g = current.g + 1;
            let nNode = openSet.find(n => n.x === neighbor.x && n.y === neighbor.y);
            if (!nNode) {
                nNode = { ...neighbor, g: tentative_g, h: heuristic(neighbor, end), parent: current };
                nNode.f = nNode.g + nNode.h;
                openSet.push(nNode);
            } else if (tentative_g < nNode.g) {
                nNode.g = tentative_g;
                nNode.f = nNode.g + nNode.h;
                nNode.parent = current;
            }
        }
        if (heuristic(current, end) < heuristic(bestNode, end)) bestNode = current;
    }

    const path = [];
    let curr = bestNode;
    while (curr) {
        path.push([minLat + curr.x * latStep, minLng + curr.y * lngStep]);
        curr = curr.parent;
    }
    path.reverse();
    if (path.length > 0) {
        path[0] = [sLat, sLng];
        path[path.length - 1] = [eLat, eLng];
    } else {
        path.push([sLat, sLng], [eLat, eLng]);
    }
    return path;
};
