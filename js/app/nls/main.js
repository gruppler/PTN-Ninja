define({

  root: {
    app_title: "PTN Ninja",
    About_App: "About PTN Ninja",

    Animate_Pieces: "Animate Pieces",
    Axis_Labels: "Axis Labels",
    Board_Opacity: "Board Opacity",
    Board_Settings: "Board Settings",
    Cancel: "Cancel",
    Clock: "Clock",
    Close: "Close",
    Current_Move: "Current Move",
    Date: "Date",
    Download: "Download",
    Edit_Mode: "Edit Mode",
    Event: "Event",
    First_Ply: "First Ply",
    Highlight_Squares: "Highlight Squares",
    Last_Ply: "Last Ply",
    Load_Sample_Game: "Load Sample Game",
    Next_Ply: "Next Ply",
    OK: "OK",
    Open: "Open",
    Permalink: "Link to this game",
    PlayPause: "Play/Pause",
    Play_Controls: "Play Controls",
    Play_Mode: "Play Mode",
    Play_Speed: "Play Speed",
    Player1: "Player1",
    Player1_name: "White",
    Player2: "Player2",
    Player2_name: "Black",
    Player_Scores: "Player Scores",
    Points: "Points",
    Preferences: "Preferences",
    Previous_Ply: "Previous Ply",
    Rating1: "Rating1",
    Rating2: "Rating2",
    Redo: "Redo",
    Result: "Result",
    Revert_Game: "Revert Game",
    Road_Connections: "Road Connections",
    Round: "Round",
    Share: "Share",
    Show_Annotations: "Show Annotations",
    Show_Hide_Errors: "Show/Hide Errors",
    Show_Parse_Errors: "Show Parse Errors",
    Site: "Site",
    Size: "Size",
    TPS: "TPS",
    Tak: "Tak",
    Time: "Time",
    Tinue: "Tinuë",
    Trim_to_current_ply: "Trim to current ply",
    Undo: "Undo",
    Unplayed_Pieces: "Unplayed Pieces",
    n_characters: "<%=n%> characters",

    result: {
      '1': "<%=player%> wins by default",
      'F': "<%=player%> wins by flats",
      'R': "<%=player%> wins by building a road",
      'tie': "It's a tie"
    },

    confirm: {
      Revert_Game: {
        title: "Revert Game",
        content: "Are you sure you want to revert the game to its original state?"
      }
    },

    warning: {
      long_url: "The permalink is over 2000 characters long, which might not work in some browsers."
    },

    error: {
      illegal_ply: "Illegal ply: \"<b><%=ply%></b>\"",
      invalid_movetext: "Invalid movetext: \"<b><%=text%></b>\"",
      invalid_file_format: "Invalid file format",
      invalid_header: "Invalid header",
      invalid_ply: "Invalid ply: \"<b><%=ply%></b>\"",
      invalid_square: "Invalid square: \"<b><%=square%></b>\"",
      invalid_tag: "Invalid tag: \"<b><%=tag%></b>\"",
      invalid_tag_value: "Invalid <%=tag%>: \"<b><%=value%></b>\"",
      invalid_TPS_dimensions: "Invalid TPS dimensions",
      missing_tags: "Missing required tag(s): <b><%=_.map(tags, _.upperFirst).join('</b>, <b>')%></b>",
      tps_missing_player: "Invalid TPS: Missing player",
      tps_missing_move: "Invalid TPS: Missing move number"
    }

  }

});
