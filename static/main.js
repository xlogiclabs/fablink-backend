let scene, camera, renderer, tooltip, controls;
let mouse = new THREE.Vector2();
let plate;
let holes = [];
let raycaster = new THREE.Raycaster();

function init() {
  const container = document.getElementById('container');
  tooltip = document.getElementById('tooltip');

  // Create the scene
  scene = new THREE.Scene();

  const rect = container.getBoundingClientRect();
  // Set up the renderer with the size of the container
  renderer = new THREE.WebGLRenderer();
  renderer.setSize(rect.width, rect.height);  // Match the container's size
  renderer.setClearColor(0xaaaaaa);  // Set background color
  container.appendChild(renderer.domElement);

  // Adjust the camera's aspect ratio to match the container
  camera = new THREE.PerspectiveCamera(75, rect.width / rect.height, 0.1, 1000);
  camera.position.set(0, 0, 50);

  // Add OrbitControls
  controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.25;
  controls.screenSpacePanning = false;
  controls.maxPolarAngle = Math.PI / 2;

  // Lighting
  const light = new THREE.DirectionalLight(0xffffff, 2);
  light.position.set(100, 100, 100);
  scene.add(light);

  const ambientLight = new THREE.AmbientLight(0x404040, 0.5);
  scene.add(ambientLight);

  // Add axes for debugging
  const axesHelper = new THREE.AxesHelper(10);
  scene.add(axesHelper);


  // File input handler
  const fileInput = document.getElementById('file-input');
  fileInput.addEventListener('change', function (event) {
    const file = event.target.files[0];
    if (file) {
      uploadAndLoadFile(file);
    }
  });

  // Raycaster for mouse interactions
  document.addEventListener('mousemove', onMouseMove, false);

  // Handle window resize
  window.addEventListener('resize', onWindowResize, false);

  // Start the animation loop
  animate();
}

function uploadAndLoadFile(file) {
  const formData = new FormData();
  formData.append('file', file);

  fetch('http://127.0.0.1:5000/api/upload_file', {
      method: 'POST',
      body: formData
  })
  .then(response => {
      if (!response.ok) {
          throw new Error(`Error: ${response.statusText}`);
      }
      return response.json();
  })
  .then(data => {
      console.log('STL URL:', data.stlUrl);
      // console.log('Holes Data:', data.holes);  // Log the holes data

      // Load the STL model
      const loader = new THREE.STLLoader();
      loader.load('http://127.0.0.1:5000' + data.stlUrl, function (geometry) {
          const material = new THREE.MeshPhongMaterial({ color: 0x0077ff, specular: 0x111111, shininess: 200 });
          plate = new THREE.Mesh(geometry, material);
          plate.scale.set(0.1, 0.1, 0.1);
          scene.add(plate);
      });



      // Store the holes data for further use (e.g., displaying tooltips)
      holes = data.holes;
      
      // Process and display the holes in the UI categorized by diameter
      processHoleData(data.holes);
  })
  .catch(error => console.error('Error loading STL:', error));
}
function onMouseMove(event) {
  // Get the CAD viewer (container) size and position
  const container = document.getElementById('container');
  const rect = container.getBoundingClientRect();
  
  // Convert mouse position to normalized device coordinates (-1 to +1) relative to the CAD viewer
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;


  // Perform raycasting only if the plate is defined
  if (plate) {
    const box = new THREE.Box3().setFromObject(plate);  // Create a bounding box around the plate
    const helper = new THREE.Box3Helper(box, 0xffff00);  // Yellow bounding box
    scene.add(helper);  // Add the helper to the scene

    
    raycaster.setFromCamera(mouse, camera);
    visualizeRaycasting();  // Visualize the raycaster's direction

    // Check if the ray intersects with the 3D object (plate)
    let intersects = raycaster.intersectObject(plate, true);
    // console.log("Raycaster Intersects:", intersects);
    if (intersects.length > 0) {
        // Find the nearest hole to the intersection point
        let closestHole = findClosestHole(intersects[0].point);

        if (closestHole) {
            // Highlight corresponding hole in dropdown
            highlightHoleInDropdown(closestHole);
        } else {
            removeHighlightFromDropdown();  // Remove highlight if no hole is detected
        }
    } else {
        removeHighlightFromDropdown();
    }
  } else {
      removeHighlightFromDropdown();
  }
}

function visualizeRaycasting() {
  // Remove existing arrow helper to avoid stacking
  if (window.arrowHelper) {
      scene.remove(window.arrowHelper);
  }

  // Adjust the length of the arrow to something smaller, e.g., 5 units instead of 20
  window.arrowHelper = new THREE.ArrowHelper(raycaster.ray.direction, raycaster.ray.origin, 5, 0xff0000);  // Length of 5
  scene.add(window.arrowHelper);
}



// Find the closest hole to the given point
function findClosestHole(point) {
  let closestHole = null;
  let minDistance = Infinity;

  holes.forEach(hole => {
      let holePosition = new THREE.Vector3(hole.position.x, hole.position.y, hole.position.z);
      let distance = holePosition.distanceTo(point);

      if (distance < 0.1 && distance < minDistance) {  // Adjust distance threshold as needed
          closestHole = hole;
          minDistance = distance;
      }
  });

  return closestHole;
}

// Highlight the corresponding hole in the dropdown when hovered over
function highlightHoleInDropdown(hole) {
  const holeDataContainer = document.getElementById('hole-data');
  const dropdownSections = holeDataContainer.getElementsByClassName('dropdown-section');

  // Remove existing highlights
  removeHighlightFromDropdown();

  // Loop through dropdown sections and highlight the matching hole
  Array.from(dropdownSections).forEach((section) => {
      const holeItems = section.getElementsByTagName('li');
      Array.from(holeItems).forEach((item) => {
          if (item.textContent.includes(`(${hole.position.x.toFixed(2)}, ${hole.position.y.toFixed(2)}, ${hole.position.z.toFixed(2)})`)) {
              item.style.backgroundColor = 'yellow';  // Highlight the corresponding hole
              // Add an edit button next to the highlighted hole
              const editButton = document.createElement('button');
              editButton.textContent = 'Edit Diameter';
              editButton.onclick = () => editHoleDiameter(hole);
              item.appendChild(editButton);
          }
      });
  });
}

// Remove the highlight from all dropdown entries
function removeHighlightFromDropdown() {
  const holeDataContainer = document.getElementById('hole-data');
  const highlightedItems = holeDataContainer.querySelectorAll('li[style*="background-color"]');

  // Remove the background color and edit button from all highlighted items
  Array.from(highlightedItems).forEach(item => {
      item.style.backgroundColor = '';
      const editButton = item.querySelector('button');
      if (editButton) {
          editButton.remove();
      }
  });
}

// Function to edit the hole's diameter (triggered by clicking the edit button)
function editHoleDiameter(hole) {
  const newDiameter = prompt(`Enter new diameter for hole at position (${hole.position.x}, ${hole.position.y}, ${hole.position.z}):`, hole.diameter);
  if (newDiameter !== null) {
      // Update the diameter in the backend (make a request to the server)
      fetch('/api/change_hole_size', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ newSize: parseFloat(newDiameter) })
      })
      .then(response => response.json())
      .then(data => {
          console.log(`Hole diameter updated to: ${newDiameter}`);
      })
      .catch(error => console.error('Error updating hole size:', error));
  }
}


function onWindowResize() {
  const container = document.getElementById('container');
  const rect = container.getBoundingClientRect();

  camera.aspect = rect.width / rect.height;  // Set aspect ratio to container's dimensions
  camera.updateProjectionMatrix();
  renderer.setSize(rect.width, rect.height);  // Resize the renderer to match the container
}

function processHoleData(holes) {
  console.log("Processing hole data: ", holes);  // Debugging log
  const holeDataContainer = document.getElementById('hole-data');
  if (!holeDataContainer) {
      console.error("Hole data container not found!");
      return;
  }

  holeDataContainer.innerHTML = '';  // Clear existing data

  // Log hole data insertion
  console.log("Hole data container found, inserting data...");

  const categorizedHoles = {};
  holes.forEach(hole => {
      const diameter = Math.round(hole.diameter);
      if (!categorizedHoles[diameter]) {
          categorizedHoles[diameter] = [];
      }
      categorizedHoles[diameter].push(hole);
  });

  for (const diameter in categorizedHoles) {
      const holeGroup = categorizedHoles[diameter];

      const dropdownSection = document.createElement('div');
      dropdownSection.className = 'dropdown-section';

      const dropdownHeader = document.createElement('div');
      dropdownHeader.className = 'dropdown-header';
      dropdownHeader.textContent = `Holes with Diameter: ${diameter} mm`;

      const dropdownContent = document.createElement('div');
      dropdownContent.className = 'dropdown-content';

      const holeList = document.createElement('ul');
      holeGroup.forEach(hole => {
          const holeItem = document.createElement('li');
          holeItem.textContent = `Position: (${hole.position.x.toFixed(2)}, ${hole.position.y.toFixed(2)}, ${hole.position.z.toFixed(2)}), Depth: ${hole.depth.toFixed(2)} mm`;
          holeList.appendChild(holeItem);
      });

      dropdownContent.appendChild(holeList);
      dropdownSection.appendChild(dropdownHeader);
      dropdownSection.appendChild(dropdownContent);
      holeDataContainer.appendChild(dropdownSection);

      // Add click event to toggle dropdown visibility
      dropdownHeader.addEventListener('click', () => {
        if (dropdownContent.style.display === 'none') {
            dropdownContent.style.display = 'block';
        } else {
            dropdownContent.style.display = 'none';
        }
    });
  }
}



function displayHoleData(categorizedHoles) {
  const holeDataContainer = document.getElementById('hole-data');
  if (!holeDataContainer) {
      console.error("Hole data container not found!");
      return;
  }

  holeDataContainer.innerHTML = '';  // Clear existing data

  for (const diameter in categorizedHoles) {
      const holeGroup = categorizedHoles[diameter];

      // Create a dropdown section for each diameter
      const dropdownSection = document.createElement('div');
      dropdownSection.className = 'dropdown-section';

      const dropdownHeader = document.createElement('div');
      dropdownHeader.className = 'dropdown-header';
      dropdownHeader.textContent = `Holes with Diameter: ${diameter} mm`;

      const dropdownContent = document.createElement('div');
      dropdownContent.className = 'dropdown-content';

      const holeList = document.createElement('ul');
      holeGroup.forEach((hole, index) => {
          const holeItem = document.createElement('li');
          holeItem.innerHTML = `
              Position: (${hole.position.x.toFixed(2)}, ${hole.position.y.toFixed(2)}, ${hole.position.z.toFixed(2)}), 
              Depth: ${hole.depth.toFixed(2)} mm 
              <button onclick="editHoleDiameter(${diameter}, ${index})">Edit Diameter</button>
          `;
          holeList.appendChild(holeItem);
      });

      dropdownContent.appendChild(holeList);
      dropdownSection.appendChild(dropdownHeader);
      dropdownSection.appendChild(dropdownContent);
      holeDataContainer.appendChild(dropdownSection);

      // Add click event to toggle dropdown visibility
      dropdownHeader.addEventListener('click', () => {
          dropdownContent.style.display = dropdownContent.style.display === 'none' ? 'block' : 'none';
      });
  }
}

// Function to handle diameter editing (for future implementation)
function editHoleDiameter(diameter, index) {
  console.log(`Editing hole with diameter ${diameter} mm, index: ${index}`);
  // Placeholder for future diameter editing logic
}


function animate() {
  requestAnimationFrame(animate);
  controls.update();  // Update OrbitControls for smooth interactions
  renderer.render(scene, camera);
}

init();
