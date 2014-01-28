require([
	//'goo/entities/GooRunner',
	//'goo/statemachine/FSMSystem',
	'goo/addons/howler/systems/HowlerSystem',
	'goo/loaders/DynamicLoader',
	'js/Game',
	'js/Time',
	'js/Input',
	'goo/entities/EntityUtils',
	'goo/math/Plane',
	'goo/math/Vector3'
], function (
	//GooRunner,
	//FSMSystem,
	HowlerSystem,
	DynamicLoader,
	Game,
	Time,
	Input,
	EntityUtils,
	Plane,
	Vector3
) {
	'use strict';

	function init() {

		// If you try to load a scene without a server, you're gonna have a bad time
		if (window.location.protocol==='file:') {
			alert('You need to run this webpage on a server. Check the code for links and details.');
			return;

			/*

			Loading scenes uses AJAX requests, which require that the webpage is accessed via http. Setting up
			a web server is not very complicated, and there are lots of free options. Here are some suggestions
			that will do the job and do it well, but there are lots of other options.

			- Windows

			There's Apache (http://httpd.apache.org/docs/current/platform/windows.html)
			There's nginx (http://nginx.org/en/docs/windows.html)
			And for the truly lightweight, there's mongoose (https://code.google.com/p/mongoose/)

			- Linux
			Most distributions have neat packages for Apache (http://httpd.apache.org/) and nginx
			(http://nginx.org/en/docs/windows.html) and about a gazillion other options that didn't
			fit in here.
			One option is calling 'python -m SimpleHTTPServer' inside the unpacked folder if you have python installed.


			- Mac OS X

			Most Mac users will have Apache web server bundled with the OS.
			Read this to get started: http://osxdaily.com/2012/09/02/start-apache-web-server-mac-os-x/

			*/
		}

		// Make sure user is running Chrome/Firefox and that a WebGL context works
		var isChrome, isFirefox, isIE, isOpera, isSafari, isCocoonJS;
		isOpera = !!window.opera || navigator.userAgent.indexOf(' OPR/') >= 0;
			isFirefox = typeof InstallTrigger !== 'undefined';
			isSafari = Object.prototype.toString.call(window.HTMLElement).indexOf('Constructor') > 0;
			isChrome = !!window.chrome && !isOpera;
			isIE = false || document.documentMode;
			isCocoonJS = navigator.appName === "Ludei CocoonJS";
		if (!(isFirefox || isChrome || isSafari || isCocoonJS || isIE === 11)) {
			alert("Sorry, but your browser is not supported.\nGoo works best in Google Chrome or Mozilla Firefox.\nYou will be redirected to a download page.");
			window.location.href = 'https://www.google.com/chrome';
		} else if (!window.WebGLRenderingContext) {
			alert("Sorry, but we could not find a WebGL rendering context.\nYou will be redirected to a troubleshooting page.");
			window.location.href = 'http://get.webgl.org/troubleshooting';
		} else {

			// Preventing brower peculiarities to mess with our control
			document.body.addEventListener('touchstart', function(event) {
				event.preventDefault();
			}, false);
			// Loading screen callback
			var progressCallback = function (handled, total) {
				var loadedPercent = (100*handled/total).toFixed();
				var loadingOverlay = document.getElementById("loadingOverlay");
				var progressBar = document.getElementById("progressBar");
				var progress = document.getElementById("progress");
				var loadingMessage = document.getElementById("loadingMessage");
				loadingOverlay.style.display = "block";
				loadingMessage.style.display = "block";
				progressBar.style.display = "block";
				progress.style.width = loadedPercent + "%";
			};

			// Create typical Goo application
			//var goo = new GooRunner({
			//	antialias: true,
			//	manuallyStartGameLoop: true
			//});
			//var fsm = new FSMSystem(goo);
			//goo.world.setSystem(fsm);

			Game.world.setSystem(new HowlerSystem());

			// add the 'Time' system to the Game.world
			// Time is used for things like time keeping and delta time, etc
			Game.world.setSystem(new Time(Game));

			// The loader takes care of loading the data
			var loader = new DynamicLoader({
				world: Game.world,
				rootPath: 'res',
				progressCallback: progressCallback});

			// array of all game references (like the candy)
			Game.ref = [];
			// array of object pools
			Game.pool = [];

			// used to track where the slice began and ended
			Game.hitPlane = new Plane(new Vector3(0,0,1), 0);
			// used to store return values from Vector math functions
			Game.hitPos = new Vector3(0,0,0);
			Game.oldHitPos = new Vector3(0,0,0);

			// create an object pool to handle generating
			// 'new' objects, this is good to reduce
			// garbage collection and recyle objects
			var ObjectPool = function(refID, objType){
				// pointer to the ref index number
				this.refID = refID;
				// object 'type' used for creating unique names
				this.objType = objType;
				// number of max objects in pool
				this.count = 0;
				// pool of objects
				this.pool = [];
			}
			ObjectPool.prototype.create = function(){
				// clone the ref
				var ent = EntityUtils.clone(Game.world, Game.ref[this.refID]);
				// give it a unique name
				ent.name = this.objType + ":" + (this.count++);
				// tell the entity the refID, so it can remove itself later
				ent.refID = this.refID;
				return ent;
			}
			// gets a new entity from the pool, or returns one
			// if it doesn't exist
			ObjectPool.prototype.getObject = function(){
				// if there are no objects in the pool
				if(this.pool.length == 0){
					// create one and return it
					return this.create();
				}
				// remove and return the first object in the pool (index 0)
				return this.pool.shift();
			}
			ObjectPool.prototype.remove = function(ent){
				console.log("ObjectPool.rmove:"+ent);
				ent.removeFromWorld();
				this.pool.push(ent);
			}

			var CandyPool = function(refID, objType){
				ObjectPool.call(this, refID, objType);
			}
			CandyPool.prototype = Object.create(ObjectPool.prototype);
			CandyPool.prototype.constructor = CandyPool;

			CandyPool.prototype.create = function(){
				// call the 'super' function create
				var ent = ObjectPool.prototype.create.call(this);
				// set the entity with the meshRendererComponent to have a hitMask of 1
				ent.transformComponent.children[0].entity.hitMask = 1;
				// speed of the candy
				ent.speed = 0;
				// rotation of the candy
				ent.rad = 0;
				// acceleration of the candy
				ent.acc = new Vector3();
				// velocity of the candy
				ent.vel = new Vector3();
				// return the entity
				return ent;
			}

			// removes the entity from its object pool
			CandyPool.prototype.remove = function(ent){
				// call the 'super' remove function
				ObjectPool.prototype.remove.call(this,ent);
				// stop updating the object
				Game.unregister("Update", ent);
			}

			var SlicePool = function(refID, objType){
				ObjectPool.call(this, refID, objType);
			}
			SlicePool.prototype = Object.create(ObjectPool.prototype);
			SlicePool.prototype.constructor = SlicePool;

			// removes the entity from its object pool
			SlicePool.prototype.remove = function(ent){
				// call the 'super' remove function
				ObjectPool.prototype.remove.call(this,ent);
				ent.opacity = 1.0;
				// stop updating the object
				Game.unregister("Update", ent);
			}


			loader.loadFromBundle('project.project', 'root.bundle', {recursive: false, preloadBinaries: true}).then(function(configs) {
				console.log(configs);
				// get the camera for use in code later
				Game.viewCam = loader.getCachedObjectForRef("round/entities/Camera.entity");
				// add the entity reference to the ref array
				Game.ref.push(loader.getCachedObjectForRef("round/entities/RootNode.entity"));
				// create and add a new Object pool for the entity ref
				Game.pool.push(new CandyPool(0, "Round"));
				// remove the ref from the world
				Game.ref[0].removeFromWorld();

				// this needs to be added to the pools at the very end
				Game.ref.push(loader.getCachedObjectForRef("slice_effect/entities/RootNode.entity"));
				Game.pool.push(new SlicePool(Game.ref.length-1, "Slice"));
				Game.ref[Game.ref.length-1].removeFromWorld();

				
				// keep track of objects scliced
				Game.sliced = {};
				// keep track of the last hit information
				Game.oldHit = null;
				// track the time the next candy should spawn
				Game.nextCandy = 0.0;
				// store the direction info the slice
				Game.slashDir = new Vector3();
				
				// number of types of candy
				var maxCandy = 1;
				function spawnNewCandy(){
					// pick a random number between 0 and max candy
					// it 'floors' it, which rounds it down to the nearest integer
					var rnd = Math.floor(Math.random()*maxCandy);
					// get a new candy from the pool
					var c = Game.pool[rnd].getObject();
					// give it a random position below the screen
					c.transformComponent.setTranslation(-2+Math.random()*4,0,0);
					// give it a random speed
					c.vel.y = 10;
					c.vel.x = -10+Math.random()*20;
					// give it an update loop
					
					Game.register("Update", c, candyUpdate);
					c.addToWorld();
				}

				function candyUpdate(){
					// 'this' refers to the entity itself

					// if we are outside of the view area, just add the entity back to the pool
					if(this.transformComponent.transform.translation.x > 20 ||
						this.transformComponent.transform.translation.x < -20 ||
						this.transformComponent.transform.translation.y < -10){
						// missed chance to slice fruit
						Game.pool[this.refID].remove(this);
						return;
					}

					// add gravity (or subtract it :D)
					this.acc.y -= 9.8;

					this.vel.x += this.acc.x * Time.dt;
					this.vel.y += this.acc.y * Time.dt;
					
					// offset the position based on speed
					this.transformComponent.transform.translation.y += this.vel.y * Time.dt;
					this.transformComponent.transform.translation.x += this.vel.x * Time.dt;
					this.transformComponent.setUpdated();

					// reset acceleration (a common practice)
					this.acc.x = 0;
					this.acc.y = 0;
				}
				Input.assignMouseButtonToAction(1, "Slice");
				Game.register("Slice", Game, mouseInput);
				function mouseInput(bool0){
					if(true == bool0){
						Game.viewCam.cameraComponent.camera.getPickRay(
						   Input.mousePosition.x,
						   Input.mousePosition.y,
						   Game.renderer.viewportWidth,
						   Game.renderer.viewportHeight,
						   Game.ray);
						// check if the ray hit the plane (it should)
						// store the position of the hit as Game.hitPos
						Game.hitPlane.rayIntersect(Game.ray, Game.oldHitPos);					}
					else{
						// assign the ray position and direction to the Game.ray
						Game.viewCam.cameraComponent.camera.getPickRay(
						   Input.mousePosition.x,
						   Input.mousePosition.y,
						   Game.renderer.viewportWidth,
						   Game.renderer.viewportHeight,
						   Game.ray);

						// check if the ray hit the plane (it should)
						// store the position of the hit as Game.hitPos
						Game.hitPlane.rayIntersect(Game.ray, Game.hitPos);

						// subtract the start and end positions
						Vector3.sub(Game.hitPos, Game.oldHitPos,  Game.slashDir);

						// if the slash mark is longer than a certain amount
						if(Game.slashDir.length() > 1){

							// get a new slash object from the pool
							var slash = Game.pool[Game.pool.length-1].getObject();
							// position it at the current hitPos (where we started to slash)
							slash.transformComponent.setTranslation(Game.oldHitPos);
							
							// use Math.atan2 to get the rad value of the direction
							var rad = Math.atan2(Game.slashDir.y, Game.slashDir.x);
							// use the rad value to rotate the slash around the Z axis
							slash.transformComponent.transform.rotation.fromAngles(0,0,rad);
							// use the length of the start and end positions to change the scale of the slash mark
							slash.transformComponent.setScale(Game.slashDir.length()*2, 0.5, 1);
							// create the time duration to remove the slash mark (0.5 seconds)
							slash.fadeTime = Time.time + 0.5;
							// this is used for a future feature to fade the object out, set it to full opacity at first
							slash.opacity = 1.0;
							// set the entity to get updates
							Game.register("Update", slash, slashFade);
							// update the slash entity transform data
							slash.transformComponent.setUpdated();
							// add it to the world.
							slash.addToWorld();
							

							// remove the slashed objects from the game
							for(var i in Game.sliced){
								Game.pool[Game.sliced[i].refID].remove(Game.sliced[i]);
							}
						}
						Game.sliced = {};
						
					}
				}
				function slashFade(){
					if(this.fadeTime < Time.time){
						this.opacity -= Time.dt*5;
						if(this.opacity <= 0){
							Game.pool[this.refID].remove(this);
						}
					}
				}

				Game.register('Update', Game, gameUpdate);

				function gameUpdate(){
					// if the time to spawn the next candy has passed
					if(Game.nextCandy < Time.time){
						Game.nextCandy = Time.time + 0.5 + Math.random();
						spawnNewCandy();
					}
					if(true == Input.Action.Slice){
					// use the camera to populate the information into the Game.ray
					Game.viewCam.cameraComponent.camera.getPickRay(
					   Input.mousePosition.x,
					   Input.mousePosition.y,
					   Game.renderer.viewportWidth,
					   Game.renderer.viewportHeight,
					   Game.ray);
					// cast a ray from the camera to the mouse position
					// we are only interested in objects with hitMask 1 set
					var hit = Game.castRay(Game.ray, 1);
					if(hit){
						// get the root parent of the mesh hit
						while(hit.entity.transformComponent.parent){
							hit.entity = hit.entity.transformComponent.parent.entity;
						}
						// if we hit an entity previously...
						if(Game.oldHit != null){
							// if the old entity is not the same as the new one
							if(Game.oldHit.entity != hit.entity){
								// set it to the new one
								Game.oldHit = hit;
								// add the entity to the sliced map
								Game.sliced[hit.entity.name] = hit.entity;
							}
						}
						else{
							Game.oldHit = hit;
							// add the entity to the sliced map
							Game.sliced[hit.entity.name] = hit.entity;
						}
					}
					else{
						// if we hit an entity previously...
						if(Game.oldHit != null){
							Game.oldHit = null;
						}
						}
					}
				}

				// This code will be called when the project has finished loading.
				//goo.renderer.domElement.id = 'goo';
				//document.body.appendChild(goo.renderer.domElement);

				// Application code goes here!

				// Start the rendering loop!
				//goo.startGameLoop();

				Game.doRender = true;

			}).then(null, function(e) {
				// If something goes wrong, 'e' is the error message from the engine.
				alert('Failed to load scene: ' + e);
				console.error(e.stack);
			});

		}
	}

	init();
});
