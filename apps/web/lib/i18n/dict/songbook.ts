/** Amharic for the songbook screens (English text -> Amharic). */
export const songbook: Record<string, string> = {
  // Member songbook
  Manage: 'አስተዳድር',
  'Search songs': 'መዝሙሮችን ፈልግ',
  'No songs found': 'ምንም መዝሙር አልተገኘም',
  'No songs yet': 'እስካሁን መዝሙር የለም',
  'Open a song to see it here.': 'መዝሙር ይክፈቱና እዚህ ያግኙት።',
  'No lyrics available.': 'ግጥም አልተገኘም።',
  'Select a song to view lyrics.': 'ግጥሙን ለማየት መዝሙር ይምረጡ።',
  Print: 'አትም',
  Pause: 'አቁም',

  // Admin: songs & categories
  'Access denied': 'መዳረሻ ተከልክሏል',
  'Only admins and Songs & Celebrations department heads can manage songs.':
    'መዝሙሮችን ማስተዳደር የሚችሉት አስተዳዳሪዎች እና የመዝሙርና ክብረ በዓላት ክፍል ኃላፊዎች ብቻ ናቸው።',
  '{songs} songs across {categories} categories':
    'በ{categories} ምድቦች {songs} መዝሙሮች',
  'All songs': 'ሁሉም መዝሙሮች',
  'Search in {category}…': '{category} ውስጥ ፈልግ…',
  'Title · Amharic': 'ርዕስ · አማርኛ',
  'Title · English': 'ርዕስ · እንግሊዝኛ',
  'Title · English (optional)': 'ርዕስ · እንግሊዝኛ (አማራጭ)',
  'No categories yet': 'እስካሁን ምድብ የለም',
  'Edit song': 'መዝሙር አስተካክል',
  'Delete song': 'መዝሙር ሰርዝ',
  'Edit category': 'ምድብ አስተካክል',
  'Delete category': 'ምድብ ሰርዝ',
  'Are you sure you want to delete “{title}”? This cannot be undone.':
    '“{title}”ን መሰረዝ እንደሚፈልጉ እርግጠኛ ነዎት? ይህ ሊመለስ አይችልም።',
  'Delete “{name}”? Songs using this category may be affected.':
    '“{name}” ይሰረዝ? ይህን ምድብ የሚጠቀሙ መዝሙሮች ሊጎዱ ይችላሉ።',
  'Create a new song category.': 'አዲስ የመዝሙር ምድብ ይፍጠሩ።',
  'Update the category details.': 'የምድቡን ዝርዝር ያስተካክሉ።',
  Emoji: 'ኢሞጂ',
  Color: 'ቀለም',
  'Deleting…': 'በመሰረዝ ላይ…',
  // Shared 'Cancel' and 'Delete' are both ሰርዝ; delete dialogs use this instead of Cancel.
  'Keep it': 'ይቆይ',
  'Saving…': 'በማስቀመጥ ላይ…',
  Update: 'አዘምን',
  Error: 'ስህተት',
  'Song deleted': 'መዝሙሩ ተሰርዟል',
  'Song created': 'መዝሙሩ ተፈጥሯል',
  'Song updated': 'መዝሙሩ ተዘምኗል',
  'Category added': 'ምድቡ ታክሏል',
  'Category deleted': 'ምድቡ ተሰርዟል',
  'Category updated': 'ምድቡ ተዘምኗል',

  // Song form
  'Select category': 'ምድብ ይምረጡ',
  'Song title in English': 'የመዝሙሩ ርዕስ በእንግሊዝኛ',
  'Save changes': 'ለውጦቹን አስቀምጥ',

  // Server action messages (shown in toasts)
  'Number must be a whole number.': 'ቁጥሩ ሙሉ ቁጥር መሆን አለበት።',
  'Number must be greater than 0.': 'ቁጥሩ ከ0 በላይ መሆን አለበት።',
  'Title is required.': 'ርዕስ ያስፈልጋል።',
  'Category is required.': 'ምድብ ያስፈልጋል።',
  'Lyrics are required.': 'ግጥም ያስፈልጋል።',
  'Lyrics must be at most 8000 characters.': 'ግጥሙ ከ8000 ፊደላት መብለጥ የለበትም።',
  'Audio URL must be a valid http(s) URL.':
    'የድምጽ አድራሻው ትክክለኛ http(s) አድራሻ መሆን አለበት።',
  'Another song already uses this number.': 'ይህ ቁጥር በሌላ መዝሙር ተይዟል።',
  'Song not found.': 'መዝሙሩ አልተገኘም።',
  'Name is required.': 'ስም ያስፈልጋል።',
  'A category with this name already exists.': 'በዚህ ስም ምድብ አስቀድሞ አለ።',
  'Category not found.': 'ምድቡ አልተገኘም።',
  'Invalid input.': 'ልክ ያልሆነ ግብዓት።',
  'You do not have permission to do this.': 'ይህን ለማድረግ ፈቃድ የለዎትም።',

  // Song recording (upload or link)
  Seek: 'ወደፊት/ወደኋላ ይሂዱ',
  Recording: 'ቅጂ',
  'Uploading…': 'በመጫን ላይ…',
  'Uploaded recording': 'የተጫነ ቅጂ',
  Replace: 'ቀይር',
  Remove: 'አስወግድ',
  'Upload audio file': 'የድምጽ ፋይል ይጫኑ',
  'MP3, M4A, AAC, OGG or WAV · max 30 MB':
    'MP3፣ M4A፣ AAC፣ OGG ወይም WAV · ቢበዛ 30 MB',
  'Or a link to a recording': 'ወይም የቅጂ ማገናኛ',
  'The uploaded file is played instead of this link.':
    'ከዚህ ማገናኛ ይልቅ የተጫነው ፋይል ይጫወታል።',
  'Choose an audio file.': 'የድምጽ ፋይል ይምረጡ።',
  'Audio file must be at most 30 MB.': 'የድምጽ ፋይሉ ከ30 MB መብለጥ የለበትም።',
  'Only MP3, M4A, AAC, OGG and WAV audio files are allowed.':
    'የሚፈቀዱት MP3፣ M4A፣ AAC፣ OGG እና WAV የድምጽ ፋይሎች ብቻ ናቸው።',
  'Upload the audio file again.': 'የድምጽ ፋይሉን እንደገና ይጫኑ።',
  'The audio upload did not finish. Please upload it again.':
    'የድምጽ ፋይሉ መጫን አልተጠናቀቀም። እባክዎ እንደገና ይጫኑት።',
  'The audio upload failed. Please try again.':
    'የድምጽ ፋይሉን መጫን አልተሳካም። እባክዎ እንደገና ይሞክሩ።',
};
