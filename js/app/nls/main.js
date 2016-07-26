define({

  root: {
    App_Title: "PTN Ninja",
    About_App: "About PTN Ninja",

    Clock: "Clock",
    Date: "Date",
    Download: "Download",
    Edit_Mode: "Edit Mode",
    Event: "Event",
    First_Ply: "First Ply",
    Last_Ply: "Last Ply",
    Load_sample_game: "Load sample game",
    Next_Ply: "Next Ply",
    Open: "Open",
    Permalink: "Permalink",
    Play_Mode: "Play Mode",
    PlayPause: "Play/Pause",
    Player1: "Player1",
    Player2: "Player2",
    Player1_name: "White",
    Player2_name: "Black",
    Points: "Points",
    Preferences: "Preferences",
    Previous_Ply: "Previous Ply",
    Rating1: "Rating1",
    Rating2: "Rating2",
    Result: "Result",
    Round: "Round",
    Share: "Share",
    ShowHide_Errors: "Show/Hide Errors",
    Site: "Site",
    Size: "Size",
    TPS: "TPS",
    Tak: "Tak",
    Time: "Time",
    Tinue: "Tinuë",
    Trim_to_current_ply: "Trim to current ply",
    n_characters: "<%=n%> characters",

    result: {
      '1': "<%=player%> wins by default",
      'F': "<%=player%> wins by flats",
      'R': "<%=player%> wins by building a road",
      'tie': "It's a tie"
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
