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

        let safeName = selectedValue.toString().replace(/\//g, '_');
        let prefix = (lessonId == 1) ? "" : "f_";
        
        // Strip out the "f_" if it's already in the button name
        if (safeName.startsWith("f_")) {
            safeName = safeName.substring(2);
            prefix = "f_";
        }

        let newSrc = "/static/images/altered_" + prefix + safeName + ".jpg";
        $("#learning-image").attr("src", newSrc);

        let explanation = "";
        if (lessonId == 1) {
            explanation = "At a shutter speed of " + selectedValue + " seconds, watch how the motion blur changes on the moving objects.";
        } else {
            explanation = "At an aperture of " + selectedValue + ", notice the depth of field—how blurry or in-focus the background becomes.";
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
                    if(response.status === "locked") return; // Failsafe

                    // Visually update the specific item dropped
                    ui.draggable.draggable("disable");
                    
                    if(response.is_correct) {
                        ui.draggable.removeClass('bg-light').addClass('bg-success text-white border-success');
                    } else {
                        ui.draggable.removeClass('bg-light').addClass('bg-danger text-white border-danger');
                        ui.draggable.effect("shake", { distance: 10, times: 2 }, 400);
                    }

                    // Blur out the other remaining choices in the SAME category to prevent reattempts
                    $(".cat-" + response.category).not(ui.draggable).addClass("blurred-option");

                    // Handle completion logic
                    if (response.question_complete) {
                        // Both parts have been answered
                        if (response.both_correct) {
                            $("#main-camera-image").attr("src", response.success_image);
                            $("#feedback-container").html('<div class="alert alert-success mt-3 shadow-sm fs-5"><strong>Perfect!</strong> Both settings are correct. Moving to next...</div>');
                        } else {
                            $("#feedback-container").html('<div class="alert alert-warning mt-3 shadow-sm fs-5"><strong>Not quite...</strong> You missed at least one setting. Moving to next...</div>');
                        }
                        
                        // Force advance after 2.5 seconds
                        setTimeout(function() {
                            window.location.href = response.next_url;
                        }, 2500);
                        
                    } else {
                        // Only one part answered, prompt them to drag the other
                        if (response.is_correct) {
                            $("#feedback-container").html('<div class="alert alert-info mt-3 shadow-sm fs-5"><strong>Good start!</strong> Now drag the other setting.</div>');
                        } else {
                            $("#feedback-container").html('<div class="alert alert-danger mt-3 shadow-sm fs-5"><strong>Incorrect.</strong> Now drag the other setting.</div>');
                        }
                    }
                }
            });
        }
    });
});