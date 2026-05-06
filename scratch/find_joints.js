const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'public', 'Female Standing Pose.fbx');
if (!fs.existsSync(filePath)) {
  console.error('File not found:', filePath);
  process.exit(1);
}

const buffer = fs.readFileSync(filePath);
console.log('FBX File Size:', buffer.length, 'bytes');

// Search for any occurrence of 'mixamorig' or bone names and print unique occurrences
const str = buffer.toString('binary');
const matches = new Set();
const regex = /[A-Za-z0-9_:]*mixamorig[A-Za-z0-9_:]*/gi;
let match;
while ((match = regex.exec(str)) !== null) {
  matches.add(match[0]);
}

console.log('Found mixamorig bones in binary:');
console.log(Array.from(matches).slice(0, 100));

// Let's also check if there is an animation clip name
const animMatches = new Set();
const animRegex = /AnimStack::[A-Za-z0-9_-]*/gi;
while ((match = animRegex.exec(str)) !== null) {
  animMatches.add(match[0]);
}
console.log('Found AnimStacks (animation clips):');
console.log(Array.from(animMatches));
