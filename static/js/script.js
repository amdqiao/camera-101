$(document).ready(function() {
    
    // ==========================================
    // 0. TIME TRACKING LOGIC
    // ==========================================
    let lessonContainer = $("#lesson-container");
    if (lessonContainer.length > 0) {
        let entryTime = Date.now();
        let currentLessonId = lessonContainer.data("lesson-id");
        
        // Triggers instantly when the user clicks a link to leave the page
        $(window).on("beforeunload", function() {
            let timeSpent = Math.round((Date.now() - entryTime) / 1000); // Convert to seconds
            let payload = JSON.stringify({
                lesson_id: currentLessonId,
                time_spent: timeSpent
            });
            // Send beacon ensures data goes through even as the page unloads
            navigator.sendBeacon('/record_time', new Blob([payload], {type: 'application/json'}));
        });
    }

    // ==========================================
    // 1. LEARNING PAGE LOGIC
    // ==========================================
    $(".setting-btn").click(function() {
        let selectedValue = $(this).data("value");
        let lessonId = $(this).data("lesson");
        
        $.ajax({
            url: '/record_click',
            type: 'POST',
            contentType: 'application/json',
            data: JSON.stringify({ selection: selectedValue })
        });

        let safeName = selectedValue.toString();
        let newSrc = "";

        // Standardized to assume .jpg for everything
        if (lessonId == 1) {
            safeName = safeName.replace(/\//g, '_');
            newSrc = "/static/images/altered_" + safeName + ".jpg";
        } else if (lessonId == 2) {
            safeName = safeName.replace("f/", "f_");
            newSrc = "/static/images/altered_" + safeName + ".jpg";
        } else if (lessonId == 3) {
            // Replaces "ISO 400" with "iso_400"
            safeName = safeName.replace("ISO ", "iso_").toLowerCase();
            newSrc = "/static/images/altered_" + safeName + ".jpg"; 
        }

        $("#learning-image").attr("src", newSrc);

        let explanation = "";
        if (lessonId == 1) {
            explanation = "At a shutter speed of " + selectedValue + " seconds, watch how the motion blur changes on the moving objects.";
        } else if (lessonId == 2) {
            explanation = "At an aperture of " + selectedValue + ", notice the depth of field—how blurry or in-focus the background becomes.";
        } else if (lessonId == 3) {
            explanation = "At " + selectedValue + ", notice how bright the image gets, but watch out for the grainy 'noise' in the shadows.";
        }
        $("#explanation-box").removeClass("d-none").text(explanation);
    });

    // ==========================================
    // 2. QUIZ PAGE LOGIC
    // ==========================================
    $(".draggable-item").draggable({
        revert: "invalid", 
        helper: "clone",
        cursor: "grabbing",
        zIndex: 100
    });

    $("#camera-dropzone").droppable({
        accept: ".draggable-item",
        drop: function(event, ui) {
            let droppedValue = ui.draggable.data("value");
            let quizId = $(this).data("quiz-id");

            $.ajax({
                url: '/process_drop',
                type: 'POST',
                contentType: 'application/json',
                data: JSON.stringify({
                    quiz_id: quizId,
                    dropped_item: droppedValue
                }),
                success: function(response) {
                    if(response.status === "locked") return;

                    ui.draggable.draggable("disable");
                    
                    if(response.is_correct) {
                        ui.draggable.removeClass('bg-light').addClass('bg-success text-white border-success');
                    } else {
                        ui.draggable.removeClass('bg-light').addClass('bg-danger text-white border-danger');
                        ui.draggable.effect("shake", { distance: 10, times: 2 }, 400);
                    }

                    // Blurs out remaining cards in the dropped category (Shutter, Aperture, OR ISO)
                    $(".cat-" + response.category).not(ui.draggable).addClass("blurred-option");

                    if (response.question_complete) {
                        if (response.all_correct) {
                            $("#main-camera-image").attr("src", response.success_image);
                            $("#feedback-container").html('<div class="alert alert-success mt-3 shadow-sm fs-5"><strong>Perfect!</strong> All 3 settings are correct. Moving to next...</div>');
                        } else {
                            $("#feedback-container").html('<div class="alert alert-warning mt-3 shadow-sm fs-5"><strong>Not quite...</strong> You missed at least one setting. Moving to next...</div>');
                        }
                        
                        setTimeout(function() {
                            window.location.href = response.next_url;
                        }, 2500);
                        
                    } else {
                        if (response.is_correct) {
                            $("#feedback-container").html('<div class="alert alert-info mt-3 shadow-sm fs-5"><strong>Good start!</strong> Drag the remaining settings.</div>');
                        } else {
                            $("#feedback-container").html('<div class="alert alert-danger mt-3 shadow-sm fs-5"><strong>Incorrect.</strong> Keep going, drag the remaining settings.</div>');
                        }
                    }
                }
            });
        }
    });
});