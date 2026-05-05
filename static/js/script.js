console.log("Camera 101 Engine Initialized. Physics and Dynamic Render Engine Active.");

$(document).ready(function() {

    // ==========================================
    // 0. CORE HELPERS (Cross-Device Pointer Physics)
    // ==========================================
    function getPointerX(e) {
        if (e.type.includes('mouse')) return e.pageX;
        if (e.type.includes('touch')) return e.originalEvent.touches.length ? e.originalEvent.touches[0].pageX : e.originalEvent.changedTouches[0].pageX;
        return 0;
    }

    function getPointerY(e) {
        if (e.type.includes('mouse')) return e.pageY;
        if (e.type.includes('touch')) return e.originalEvent.touches.length ? e.originalEvent.touches[0].pageY : e.originalEvent.changedTouches[0].pageY;
        return 0;
    }

    // ==========================================
    // 1. TIME TRACKING LOGIC (Global)
    // ==========================================
    if ($("#lesson-container").length > 0) {
        let entryTime = Date.now();
        let currentLessonId = $("#lesson-container").attr("data-lesson-id");
        
        $(window).on("beforeunload", function() {
            let timeSpent = Math.round((Date.now() - entryTime) / 1000);
            let payload = JSON.stringify({ lesson_id: currentLessonId, time_spent: timeSpent });
            navigator.sendBeacon('/record_time', new Blob([payload], {type: 'application/json'}));
        });
    }

    // ==========================================
    // 2. LEARNING PAGE LOGIC (Isolated Fence)
    // ==========================================
    if ($("#lesson-container").length > 0) {
        
        function processCameraSetting(element) {
            let selectedValue = element.attr("data-value");
            let lessonId = element.attr("data-lesson");
            if (!selectedValue) return; 
            
            $.ajax({
                url: '/record_click',
                type: 'POST',
                contentType: 'application/json',
                data: JSON.stringify({ selection: selectedValue })
            });

            let safeName = selectedValue.toString();
            let newSrc = "";

            if (lessonId == "1") {
                safeName = safeName.replace(/\//g, '_');
                newSrc = "/static/images/altered_" + safeName + ".jpg";
            } else if (lessonId == "2") {
                safeName = safeName.replace("f/", "f_");
                newSrc = "/static/images/altered_" + safeName + ".jpg";
            } else if (lessonId == "3") {
                safeName = safeName.replace("ISO ", "iso_").toLowerCase();
                newSrc = "/static/images/altered_" + safeName + ".jpg"; 
            }

            $("#learning-image").attr("src", newSrc);

            let explanation = "";
            if (lessonId == "1") explanation = "At a shutter speed of " + selectedValue + " seconds, watch how the motion blur changes on the moving objects.";
            else if (lessonId == "2") explanation = "At an aperture of " + selectedValue + ", notice the depth of field—how blurry or in-focus the background becomes.";
            else if (lessonId == "3") explanation = "At " + selectedValue + ", notice how bright the image gets, but watch out for the grainy 'noise' in the shadows.";
            
            $("#explanation-box").removeClass("d-none").text(explanation);
        }

        // --- HORIZONTAL SLIDER (APERTURE) ---
        if ($("#interactive-ring").length) {
            let isDraggingRing = false, hasDraggedRing = false; 
            let startPageX = 0, startTranslateX = 0, currentTranslateX = -40; 
            const ring = $("#interactive-ring");
            const markWidth = 80;
            const totalMarks = ring.find(".ring-mark").length;
            
            ring.find(".ring-mark").click(function(e) {
                if (hasDraggedRing) return e.preventDefault();
                let index = parseInt($(this).attr("data-index"));
                currentTranslateX = -(index * markWidth + (markWidth / 2));
                ring.css("transform", `translateX(${currentTranslateX}px)`);
                processCameraSetting($(this));
            });

            ring.on('mousedown touchstart', function(e) {
                isDraggingRing = true; hasDraggedRing = false;
                ring.css('transition', 'none').css('cursor', 'grabbing');
                startPageX = getPointerX(e);
                startTranslateX = currentTranslateX;
            });

            $(document).on('mousemove touchmove', function(e) {
                if (!isDraggingRing) return;
                let deltaX = getPointerX(e) - startPageX;
                if (Math.abs(deltaX) > 5) hasDraggedRing = true;
                if (hasDraggedRing) {
                    currentTranslateX = startTranslateX + (deltaX * 1.5); 
                    ring.css("transform", `translateX(${currentTranslateX}px)`);
                }
            });

            $(document).on('mouseup touchend', function() {
                if (!isDraggingRing) return;
                isDraggingRing = false;
                ring.css('transition', 'transform 0.3s cubic-bezier(0.25, 1, 0.5, 1)').css('cursor', 'grab');

                if (hasDraggedRing) {
                    let snapIndex = Math.round(Math.abs(currentTranslateX + (markWidth / 2)) / markWidth);
                    if (snapIndex < 0) snapIndex = 0;
                    if (snapIndex >= totalMarks) snapIndex = totalMarks - 1;

                    currentTranslateX = -(snapIndex * markWidth + (markWidth / 2));
                    ring.css("transform", `translateX(${currentTranslateX}px)`);
                    processCameraSetting(ring.find(".ring-mark").eq(snapIndex));
                    setTimeout(() => { hasDraggedRing = false; }, 50);
                }
            });
            
            ring.find(".ring-mark").first().click();
        }

        // --- ROTATING DIAL (SHUTTER/ISO) ---
        if ($("#interactive-dial").length) {
            let isDraggingDial = false, hasDraggedDial = false;
            let dial = $("#interactive-dial");
            let currentRotation = 0, startRotation = 0, startAngle = 0;
            const numOptions = parseInt(dial.attr("data-options-count"));
            const angleStep = 360 / numOptions;

            dial.find(".dial-mark").click(function(e) {
                if (hasDraggedDial) return e.preventDefault();
                let index = parseInt($(this).attr("data-index"));
                let targetAngle = -(index * angleStep);
                let diff = (targetAngle - currentRotation) % 360;
                if (diff > 180) diff -= 360;
                if (diff < -180) diff += 360;
                
                currentRotation += diff;
                dial.css("transform", `rotate(${currentRotation}deg)`);
                processCameraSetting($(this));
            });

            dial.on('mousedown touchstart', function(e) {
                isDraggingDial = true; hasDraggedDial = false;
                dial.css('transition', 'none').css('cursor', 'grabbing');
                
                let rect = dial[0].getBoundingClientRect();
                let centerX = rect.left + rect.width / 2;
                let centerY = rect.top + rect.height / 2;
                startAngle = Math.atan2(getPointerY(e) - centerY, getPointerX(e) - centerX) * (180 / Math.PI);
                startRotation = currentRotation;
            });

            $(document).on('mousemove touchmove', function(e) {
                if (!isDraggingDial) return;
                let rect = dial[0].getBoundingClientRect();
                let centerX = rect.left + rect.width / 2;
                let centerY = rect.top + rect.height / 2;
                
                let currentAngle = Math.atan2(getPointerY(e) - centerY, getPointerX(e) - centerX) * (180 / Math.PI);
                let angleDiff = currentAngle - startAngle;
                
                if (angleDiff > 180) angleDiff -= 360;
                if (angleDiff < -180) angleDiff += 360;
                
                if (Math.abs(angleDiff) > 2) hasDraggedDial = true;
                if (hasDraggedDial) {
                    currentRotation = startRotation + angleDiff; 
                    dial.css("transform", `rotate(${currentRotation}deg)`);
                }
            });

            $(document).on('mouseup touchend', function() {
                if (!isDraggingDial) return;
                isDraggingDial = false;
                dial.css('transition', 'transform 0.3s cubic-bezier(0.25, 1, 0.5, 1)').css('cursor', 'grab');

                if (hasDraggedDial) {
                    let snapIndex = Math.round(Math.abs(currentRotation) / angleStep) % numOptions;
                    if (currentRotation > 0) snapIndex = (numOptions - snapIndex) % numOptions;

                    let diff = (-(snapIndex * angleStep) - currentRotation) % 360;
                    if (diff > 180) diff -= 360;
                    if (diff < -180) diff += 360;
                    
                    currentRotation += diff;
                    dial.css("transform", `rotate(${currentRotation}deg)`);
                    processCameraSetting(dial.find(".dial-mark").eq(snapIndex));
                    setTimeout(() => { hasDraggedDial = false; }, 50);
                }
            });

            dial.find(".dial-mark").first().click();
        }
    }


    // ==========================================
    // 3. QUIZ PAGE LOGIC (Isolated Fence)
    // ==========================================
    if ($("#quiz-interface").length > 0) {
        
        let interfaceDiv = $("#quiz-interface");
        
        // STRICT DYNAMIC BINDING (No Hardcoded Fallbacks)
        let baseName = interfaceDiv.attr("data-base-name");
        let targetShutter = interfaceDiv.attr("data-target-shutter");
        let targetAperture = interfaceDiv.attr("data-target-aperture");
        let targetIso = interfaceDiv.attr("data-target-iso");
        
        // Start state (Dials visually default to the middle)
        let cameraState = { shutter: "1/60", aperture: "f/8", iso: "ISO 3200" };

        let quizStartTime = Date.now();
        let stopwatchInterval = setInterval(function() {
            let elapsed = Math.floor((Date.now() - quizStartTime) / 1000);
            let mins = Math.floor(elapsed / 60);
            let secs = elapsed % 60;
            $("#live-stopwatch").text((mins < 10 ? "0" : "") + mins + ":" + (secs < 10 ? "0" : "") + secs);
        }, 1000);

        // --- THE HYBRID RENDER ENGINE ---
        function calculateRender(shutter, aperture, iso) {
            let imageVariant = "full"; 
            let cssBlur = 0;
            let brightness = 1;
            let noise = 0;

            // 1. Shutter (Smart Motion Blur)
            if (shutter === "1/15") {
                imageVariant = "blurred"; 
            } else if (shutter === "1/60") {
                // ONLY blur subjects that are actually moving fast!
                // Static subjects (Hero, Perfume) will stay perfectly sharp at 1/60.
                if (baseName === "cat" || baseName === "cricket") {
                    cssBlur += 1.5; 
                }
            }

            if (imageVariant !== "blurred") {
    if (aperture === "f/2.8") {
        imageVariant = "focus"; 
    } else if (aperture === "f/8" || aperture === "f/16") {
        // Now explicitly handles f/16 alongside f/8
        imageVariant = "full"; 
    }
}

            // 3. ISO
            if (iso === "ISO 400") { brightness = 1; noise = 0; }
            if (iso === "ISO 3200") { brightness = 1.3; noise = 0.4; }
            if (iso === "ISO 25600") { brightness = 1.6; noise = 0.8; }

            return {
                src: `/static/images/${baseName}_${imageVariant}.jpg`,
                filter: `brightness(${brightness}) blur(${cssBlur}px)`,
                noiseOpacity: noise
            };
        }
        

        function updateLivePreview() {
            let render = calculateRender(cameraState.shutter, cameraState.aperture, cameraState.iso);
            $("#live-preview-image").attr("src", render.src).css("filter", render.filter);
            $("#noise-overlay").css("opacity", render.noiseOpacity);
        }

        function initTargetImage() {
            let targetRender = calculateRender(targetShutter, targetAperture, targetIso);
            $("#target-preview-image").attr("src", targetRender.src).css("filter", targetRender.filter);
            $("#target-noise-overlay").css("opacity", targetRender.noiseOpacity);
        }
        
        initTargetImage();
        updateLivePreview(); 

        // --- QUIZ DIALS (Pure Circular Physics) ---
        function setupQuizDial(dialId, stateKey) {
            let dial = $(dialId);
            if(!dial.length) return;
            
            let currentRotation = 0, startRotation = 0, startAngle = 0;
            let isDragging = false, hasDragged = false;
            const numOptions = parseInt(dial.attr("data-options-count"));
            const angleStep = 360 / numOptions;

            dial.find(".dial-mark").click(function(e) {
                if (hasDragged) return e.preventDefault();
                let index = parseInt($(this).attr("data-index"));
                let diff = (-(index * angleStep) - currentRotation) % 360;
                if (diff > 180) diff -= 360;
                if (diff < -180) diff += 360;
                
                currentRotation += diff;
                dial.css("transform", `rotate(${currentRotation}deg)`);
                cameraState[stateKey] = $(this).attr("data-value");
                updateLivePreview();
            });

            dial.on('mousedown touchstart', function(e) {
                isDragging = true; hasDragged = false;
                dial.css('transition', 'none').css('cursor', 'grabbing');
                
                let rect = dial[0].getBoundingClientRect();
                let centerX = rect.left + rect.width / 2;
                let centerY = rect.top + rect.height / 2;
                startAngle = Math.atan2(getPointerY(e) - centerY, getPointerX(e) - centerX) * (180 / Math.PI);
                startRotation = currentRotation;
            });

            $(document).on('mousemove touchmove', function(e) {
                if (!isDragging) return;
                let rect = dial[0].getBoundingClientRect();
                let centerX = rect.left + rect.width / 2;
                let centerY = rect.top + rect.height / 2;
                
                let currentAngle = Math.atan2(getPointerY(e) - centerY, getPointerX(e) - centerX) * (180 / Math.PI);
                let angleDiff = currentAngle - startAngle;
                
                if (angleDiff > 180) angleDiff -= 360;
                if (angleDiff < -180) angleDiff += 360;
                
                if (Math.abs(angleDiff) > 2) hasDragged = true;
                if (hasDragged) {
                    currentRotation = startRotation + angleDiff; 
                    dial.css("transform", `rotate(${currentRotation}deg)`);
                }
            });

            $(document).on('mouseup touchend', function() {
                if (!isDragging) return;
                isDragging = false;
                dial.css('transition', 'transform 0.4s cubic-bezier(0.25, 1, 0.5, 1)').css('cursor', 'grab');

                if (hasDragged) {
                    let snapIndex = Math.round(Math.abs(currentRotation) / angleStep) % numOptions;
                    if (currentRotation > 0) snapIndex = (numOptions - snapIndex) % numOptions;

                    let diff = (-(snapIndex * angleStep) - currentRotation) % 360;
                    if (diff > 180) diff -= 360;
                    if (diff < -180) diff += 360;
                    
                    currentRotation += diff;
                    dial.css("transform", `rotate(${currentRotation}deg)`);
                    cameraState[stateKey] = dial.find(".dial-mark").eq(snapIndex).attr("data-value");
                    
                    updateLivePreview();
                    setTimeout(() => { hasDragged = false; }, 50);
                }
            });
            
            dial.find(".dial-mark").eq(1).click();
        }

        // --- QUIZ RING (APERTURE) ---
        function setupQuizRing(ringId) {
            let ring = $(ringId);
            if(!ring.length) return;

            let currentTranslateX = -33, startPageX = 0, startTranslateX = 0;
            let isDragging = false, hasDragged = false;
            const markWidth = 66; 
            const totalMarks = ring.find(".ring-mark").length;

            ring.find(".ring-mark").click(function(e) {
                if (hasDragged) return e.preventDefault();
                let index = parseInt($(this).attr("data-index"));
                currentTranslateX = -(index * markWidth + (markWidth / 2));
                ring.css("transform", `translateX(${currentTranslateX}px)`);
                cameraState.aperture = $(this).attr("data-value");
                updateLivePreview();
            });

            ring.on('mousedown touchstart', function(e) {
                isDragging = true; hasDragged = false;
                ring.css('transition', 'none').css('cursor', 'grabbing');
                startPageX = getPointerX(e);
                startTranslateX = currentTranslateX;
            });

            $(document).on('mousemove touchmove', function(e) {
                if (!isDragging) return;
                let deltaX = getPointerX(e) - startPageX;
                if (Math.abs(deltaX) > 5) hasDragged = true;
                if (hasDragged) {
                    currentTranslateX = startTranslateX + (deltaX * 1.5);
                    ring.css("transform", `translateX(${currentTranslateX}px)`);
                }
            });

            $(document).on('mouseup touchend', function() {
                if (!isDragging) return;
                isDragging = false;
                ring.css('transition', 'transform 0.4s cubic-bezier(0.25, 1, 0.5, 1)').css('cursor', 'grab');

                if (hasDragged) {
                    let snapIndex = Math.round(Math.abs(currentTranslateX + (markWidth / 2)) / markWidth);
                    if (snapIndex < 0) snapIndex = 0;
                    if (snapIndex >= totalMarks) snapIndex = totalMarks - 1;

                    currentTranslateX = -(snapIndex * markWidth + (markWidth / 2));
                    ring.css("transform", `translateX(${currentTranslateX}px)`);
                    cameraState.aperture = ring.find(".ring-mark").eq(snapIndex).attr("data-value");
                    
                    updateLivePreview();
                    setTimeout(() => { hasDragged = false; }, 50);
                }
            });
            
            ring.find(".ring-mark").eq(1).click();
        }

        setupQuizDial("#quiz-shutter-dial", "shutter");
        setupQuizDial("#quiz-iso-dial", "iso");
        setupQuizRing("#quiz-aperture-ring");

        $("#submit-capture-btn").click(function() {
            let btn = $(this);
            btn.prop("disabled", true).text("Processing...");

            $.ajax({
                url: '/submit_quiz',
                type: 'POST',
                contentType: 'application/json',
                data: JSON.stringify({
                    quiz_id: interfaceDiv.attr("data-quiz-id"),
                    shutter: cameraState.shutter,
                    aperture: cameraState.aperture,
                    iso: cameraState.iso
                }),
                success: function(response) {
                    if (response.all_correct) {
    clearInterval(stopwatchInterval); 
    $("#live-preview-image").css({"filter": "brightness(2)", "transition": "0.1s"});
    setTimeout(() => {
        // Recalculate and restore the correct filters instead of removing them
        let finalRender = calculateRender(cameraState.shutter, cameraState.aperture, cameraState.iso);
        $("#live-preview-image").css({"filter": finalRender.filter, "transition": "0.5s"});
        
        $("#quiz-feedback").html('<div class="alert alert-success fw-bold shadow-sm">Perfect Shot! Moving on...</div>');
                            setTimeout(() => { window.location.href = response.next_url; }, 2500);
                        }, 150);
                    } else {
                        btn.prop("disabled", false).text("📸 Try Again");
                        let feedbackHtml = '<div class="alert alert-warning shadow-sm text-start"><ul class="mb-0">';
                        if (!response.shutter_feedback) feedbackHtml += '<li>Check your <strong>Shutter Speed</strong>.</li>';
                        if (!response.aperture_feedback) feedbackHtml += '<li>Check your <strong>Aperture</strong>.</li>';
                        if (!response.iso_feedback) feedbackHtml += '<li>Check your <strong>ISO</strong>.</li>';
                        feedbackHtml += '</ul></div>';
                        $("#quiz-feedback").html(feedbackHtml);
                    }
                }
            });
        });
    }
});