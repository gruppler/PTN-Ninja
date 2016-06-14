define({

  root: {
    App_Title: "PTN Player",

    Clock: "Clock",
    Date: "Date",
    Download: "Download",
    Edit_Mode: "Edit Mode",
    Event: "Event",
    First_Ply: "First Ply",
    Last_Ply: "Last Ply",
    Next_Ply: "Next Ply",
    Permalink: "Permalink",
    Play_Mode: "Play Mode",
    PlayPause: "Play/Pause",
    Player1: "Player1",
    Player2: "Player2",
    Points: "Points",
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
    n_characters: "<%=n%> characters",

    result: {
      'F': "<%=player%> wins by flats",
      'R': "<%=player%> wins by building a road",
      'tie': "It's a tie"
    },

    success: {},

    warning: {
      long_url: "The permalink is over 2000 characters long, which might not work in some browsers."
    },

    error: {
      illegal_ply: "Illegal move: \"<b><%=ply%></b>\"",
      invalid_body: "Invalid movetext",
      invalid_file_format: "Invalid file format",
      invalid_header: "Invalid header",
      invalid_ply: "Invalid move: \"<b><%=ply%></b>\"",
      invalid_square: "Invalid square: \"<b><%=square%></b>\"",
      invalid_tag: "Invalid tag: \"<b><%=tag%></b>\"",
      invalid_tag_value: "Invalid <%=tag%>: \"<b><%=value%></b>\"",
      invalid_TPS_dimensions: "Invalid TPS dimensions",
      missing_tags: "Missing required tag(s): <b><%=_.map(tags, _.upperFirst).join('</b>, <b>')%></b>"
    },

    help: {},

    info: {},

  }

});
