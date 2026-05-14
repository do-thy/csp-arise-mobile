type AriseNode = {
  nodeID: string;
  posX?: string | number;
  posY?: string | number;
  posZ?: string | number;
  neighbors?: string[];
  rooms?: any[];
};

type NodeMap = Record<string, AriseNode>;

const reconstructPath = (
  cameFrom: Record<string, string>,
  startID: string,
  endID: string,
  allNodes: NodeMap
) => {
  let path: AriseNode[] = [];
  let currentID = endID;

  while (currentID !== startID) {
    path.push(allNodes[currentID]);
    currentID = cameFrom[currentID];
  }

  path.push(allNodes[startID]);
  return path.reverse();
};

export const findPath = (
  startNodeID: string,
  targetNodeID: string,
  allNodes: NodeMap
): AriseNode[] | null => {
  const findActualID = (id: string) => {
    if (allNodes[id]) return id;
    const trimmed = id.trim();
    if (allNodes[trimmed]) return trimmed;
    const found = Object.keys(allNodes).find(key => key.toLowerCase() === trimmed.toLowerCase());
    return found || trimmed;
  };

  const start = findActualID(startNodeID);
  const target = findActualID(targetNodeID);

  if (!allNodes[start] || !allNodes[target]) {
    console.error(`MISSING IN DATABASE: Start(${start}) or Target(${target})`);
    return null;
  }

  let queue = [start];
  let visited = new Set<string>([start]);
  let cameFrom: Record<string, string> = {};

  while (queue.length > 0) {
    const currentNodeID = queue.shift();
    if (!currentNodeID) break;

    if (currentNodeID === target) {
      return reconstructPath(cameFrom, start, target, allNodes);
    }

    const currentNode = allNodes[currentNodeID];
    const neighbors = currentNode?.neighbors;
    if (!neighbors) continue;

    for (const rawNeighborID of neighbors) {
      const neighborID = rawNeighborID.trim();
      const finalNeighborID = allNodes[neighborID] ? neighborID :
        allNodes[neighborID.replace("main_campus_parent_", "")] ? neighborID.replace("main_campus_parent_", "") :
        Object.keys(allNodes).find(key => key === neighborID || key.endsWith(neighborID.replace("main_campus_parent_", ""))) || neighborID;

      if (finalNeighborID && !visited.has(finalNeighborID)) {
        visited.add(finalNeighborID);
        cameFrom[finalNeighborID] = currentNodeID;
        queue.push(finalNeighborID);
      }
    }
  }

  console.log(
    `BFS finished searching. Visited ${visited.size} nodes. Path to ${target} not found.`
  );
  return null;
};
