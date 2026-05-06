// We will write a small ES script that imports Three and FBXLoader and prints bone rotations.
// Since running three.js in bare node can be complex, let's just inspect some raw data or write a quick web console log or a small Node script with jsdom/canvas if needed, or simply let Node run three.
// Node can easily run Three.js! Let's import Three and FBXLoader.
const { TextDecoder, TextEncoder } = require('util');
global.TextDecoder = TextDecoder;
global.TextEncoder = TextEncoder;

const THREE = require('three');
const { FBXLoader } = require('three/examples/jsm/loaders/FBXLoader.js');

// Since FBXLoader requires document/window to create some DOM elements sometimes, let's mock it if needed.
global.window = {
  navigator: { userAgent: 'node' }
};
global.document = {
  createElement: () => ({})
};

const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'public', 'Female Standing Pose.fbx');
const buffer = fs.readFileSync(filePath);

// FBXLoader in node might require some effort, let's just write a script that mock loads or let's use a simpler way.
// Wait, we can actually just print the values directly from the browser console, or we can write a tiny test in our React app that console.logs them!
// Yes! Let's check the console logs in our React app.
console.log("Checking if we can run three loader in Node...");
try {
  const loader = new FBXLoader();
  const fbx = loader.parse(buffer.buffer);
  console.log("FBX parsed successfully in Node!");
  const bones = [];
  fbx.traverse(child => {
    if (child.isBone) {
      bones.push({
        name: child.name,
        q: [child.quaternion.x, child.quaternion.y, child.quaternion.z, child.quaternion.w]
      });
    }
  });
  console.log("Bones and quaternions:");
  console.log(bones.slice(0, 15));
} catch (e) {
  console.error("Error parsing FBX in Node:", e.message);
}
