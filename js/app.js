class Playback {
  constructor(sequence) {
    this.sequence = sequence;
    this.currentIndex = 0;

    // Create the main container that fills the viewport.
    this.mediaContainer = document.createElement("div");
    this.mediaContainer.style.width = "100vw";
    this.mediaContainer.style.height = "100vh";
    this.mediaContainer.style.overflow = "hidden";
    this.mediaContainer.style.position = "relative";
    document.body.appendChild(this.mediaContainer);

    // Create a persistent video container for video playback.
    // This container will remain in the DOM (even if hidden for images)
    // so that the video double buffering works without interruption.
    this.videoContainer = document.createElement("div");
    this.videoContainer.style.position = "absolute";
    this.videoContainer.style.top = "0";
    this.videoContainer.style.left = "0";
    this.videoContainer.style.width = "100%";
    this.videoContainer.style.height = "100%";
    this.mediaContainer.appendChild(this.videoContainer);

    // Create two video elements for double buffering.
    this.videoA = this.createVideoElement();
    this.videoB = this.createVideoElement();
    this.activeVideo = null;   // The currently playing video element.
    this.inactiveVideo = null; // The preloading video element.

    // For image transitions.
    this.timeoutId = null;
  }

  // Helper: create a video element with common settings.
  createVideoElement() {
    var video = document.createElement("video");
    video.style.width = "100%";
    video.style.height = "100%";
    video.style.objectFit = "cover";
    video.muted = true;
    video.preload = "auto";
    return video;
  }

  // Validate that a media resource (video or image) loads successfully.
  async validateMedia(src, type) {
    return new Promise(function(resolve, reject) {
      if (type === "video") {
        var video = document.createElement("video");
        video.src = src;
        video.preload = "auto";
        video.onloadeddata = video.onload = function() {
          resolve(true);
        };
        video.onerror = function() {
          reject(new Error("Invalid video: " + src));
        };
      } else if (type === "image") {
        var img = new Image();
        img.src = src;
        img.onload = function() {
          resolve(true);
        };
        img.onerror = function() {
          reject(new Error("Invalid image: " + src));
        };
      }
    });
  }

  // Decide which media item to play next.
  async playSequence() {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
    var item = this.sequence[this.currentIndex];
    if (item.type === "video") {
      this.playVideo(item);
    } else if (item.type === "image") {
      this.playImage(item);
    } else {
      console.error("Unknown media type:", item.type);
      this.next();
    }
  }

  // Play a video using double buffering.
  async playVideo(item) {

    // Log the current video being played.
    console.log(`ACTIVE: Playing video ${this.currentIndex}: ${item.src}`);

    try {
      await this.validateMedia(item.src, "video");
    } catch (error) {
      console.error(error.message);
      return this.next();
    }
    // Make sure the video container is visible.
    this.videoContainer.style.display = "block";
    // (Do not clear the entire media container; just clear the video container.)
    this.videoContainer.innerHTML = "";

    // Clear images and store hours from the media container.
    Array.from(this.mediaContainer.children).forEach(child => {
      if (child !== this.videoContainer) {
        child.remove();
      }
    });

    // Initialize video elements if not already set.
    if (!this.activeVideo) {
      this.activeVideo = this.videoA;
      this.inactiveVideo = this.videoB;
    }
    // Append the active video element into the video container.
    this.videoContainer.appendChild(this.activeVideo);
    this.activeVideo.src = item.src;
    this.activeVideo.onended = null;
    this.activeVideo.onended = () => { this.swapAndPlayNext(); };

    this.activeVideo.play().catch(function(err) {
      console.error(err);
    });

    // Preload the next video if available.
    var nextIndex = (this.currentIndex + 1) % this.sequence.length;
    var nextItem = this.sequence[nextIndex];
    if (nextItem && nextItem.type === "video") {
      this.inactiveVideo.src = nextItem.src;
      this.inactiveVideo.load();
    } else {
      this.inactiveVideo.removeAttribute("src");
    }
  }

  // Swap video elements for seamless video transitions.
  swapAndPlayNext() {
    var nextIndex = (this.currentIndex + 1) % this.sequence.length;
    var nextItem = this.sequence[nextIndex];
    this.currentIndex = nextIndex;

    if (nextItem && nextItem.type === "video") {
      // Swap active and inactive video elements.
      var temp = this.activeVideo;
      this.activeVideo = this.inactiveVideo;
      this.inactiveVideo = temp;
      this.playSequence();
    } else {
      // If the next item is not a video, exit video mode.
      if (this.activeVideo) {
        this.activeVideo.pause();
        this.activeVideo.src = "";
      }
      this.activeVideo = null;
      this.inactiveVideo = null;
      this.playSequence();
    }
  }

  // Play an image for its specified duration.
  // The image will be shown at its natural size in the top‑left.
  async playImage(item) {
    // Log the current image being displayed.
    console.log(`ACTIVE: Displaying image ${this.currentIndex}: ${item.src} for ${item.duration} seconds`);

    try {
      await this.validateMedia(item.src, "image");
    } catch (error) {
      console.error(error.message);
      return this.next();
    }
    // Hide the video container so it does not interfere with the image.
    this.videoContainer.style.display = "none";
    // Clear the media container (but then re-append the video container for future videos).
    this.mediaContainer.innerHTML = "";
    this.mediaContainer.appendChild(this.videoContainer);

    // Create the image element.
    var img = document.createElement("img");
    img.src = item.src;
    // Display the image at its natural size by not forcing width/height.
    // Position it at the top‑left.
    img.style.position = "absolute";
    img.style.top = "0";
    img.style.left = "0";
    img.style.width = "auto";
    img.style.height = "auto";
    this.mediaContainer.appendChild(img);

    // Generate and append store hours
    const storeHoursContainer = this.generateStoreHours();
    this.mediaContainer.appendChild(storeHoursContainer);

    // Preload the next video if the next item is a video.
    var nextIndex = (this.currentIndex + 1) % this.sequence.length;
    var nextItem = this.sequence[nextIndex];
    if (nextItem && nextItem.type === "video") {
      if (!this.activeVideo) {
        this.activeVideo = this.videoA;
        this.inactiveVideo = this.videoB;
      }
      this.inactiveVideo.src = nextItem.src;
      this.inactiveVideo.load();
    }

    this.timeoutId = setTimeout(() => { this.next(); }, item.duration * 1000);
  }

  generateStoreHours() {
    // Get store data based on config store number
    const store = storeData.stores.find(store => store.storeNumber === config.storeNumber);
    console.log(store);
    if (!store) {
      console.error("Store not found");
      return;
    }

    // Create container structure
    const storeHoursContainer = document.createElement('div');
    storeHoursContainer.className = 'storeHoursContainer';

    const content = document.createElement('div');
    content.className = 'content';

    const headline = document.createElement('div');
    headline.className = 'headline';

    // Add headline content
    const h1 = document.createElement('h1');
    h1.textContent = 'Office Hours';
    const h3 = document.createElement('h3');
    h3.textContent = store.address;

    headline.appendChild(h1);
    headline.appendChild(h3);

    // Create bottom block
    const bottomBlock = document.createElement('div');
    bottomBlock.className = 'bottom-block';

    // Create week list
    const weekList = document.createElement('div');
    weekList.className = 'week-list';

    // Array of days for iteration
    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    
    days.forEach(day => {
      const dayBlock = document.createElement('div');
      dayBlock.className = 'day-block';

      const dayName = document.createElement('h2');
      dayName.className = 'dayOfWeek';
      dayName.textContent = day.charAt(0).toUpperCase() + day.slice(1) + ':';

      const hours = document.createElement('p');
      hours.className = 'hours';
      hours.textContent = store[day];

      dayBlock.appendChild(dayName);
      dayBlock.appendChild(hours);
      weekList.appendChild(dayBlock);
    });

    // Create QR block
    const qrBlock = document.createElement('div');
    qrBlock.className = 'qr-block';

    const qrCode = document.createElement('img');
    qrCode.className = 'qr-code';
    qrCode.src = store['qr-code'];
    qrCode.alt = 'QR Code';

    const qrText = document.createElement('h3');
    qrText.className = 'qr-text';
    qrText.textContent = 'Make an appointment or find another office';

    qrBlock.appendChild(qrCode);
    qrBlock.appendChild(qrText);

    // Assemble the components
    bottomBlock.appendChild(weekList);
    bottomBlock.appendChild(qrBlock);
    content.appendChild(headline);
    content.appendChild(bottomBlock);
    storeHoursContainer.appendChild(content);

    return storeHoursContainer;
  }

  // Advance to the next media item.
  next() {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
    // Do not clear the entire media container here.
    this.currentIndex = (this.currentIndex + 1) % this.sequence.length;
    this.playSequence();
  }

  // Start the playback sequence.
  start() {
    if (!this.sequence || !Array.isArray(this.sequence)) {
      throw new Error("Invalid sequence provided.");
    }
    this.playSequence();
  }
}

function initializePlayer() {
  try {
    var player = new Playback(config.playbackSequenece);
    player.start();
  } catch (error) {
    console.error("Failed to initialize player:", error.message);
  }
}

document.addEventListener("DOMContentLoaded", function() {
  initializePlayer();
});

