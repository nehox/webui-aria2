import angular from "angular";

export default angular.module("webui.services.alldebrid", []).factory("$alldebrid", [
  "$q",
  function($q) {
    let apiKey = localStorage.getItem("alldebridApiKey") || "";
    const BASE_URL = "https://api.alldebrid.com/v4";

    function setApiKey(key) {
      apiKey = key;
      localStorage.setItem("alldebridApiKey", key);
    }

    function request(endpoint, method, body, isFormData) {
      const headers = {
        Authorization: `Bearer ${apiKey}`
      };
      let options = {
        method,
        headers
      };
      if (body) {
        if (isFormData) {
          options.body = body;
        } else {
          headers["Content-Type"] = "application/x-www-form-urlencoded";
          options.body = new URLSearchParams(body);
        }
      }
      return fetch(BASE_URL + endpoint, options)
        .then(r => r.json())
        .catch(e => $q.reject(e));
    }

    // Upload un fichier torrent
    function uploadTorrentFile(file) {
      const formData = new FormData();
      formData.append("files[0]", file); // Correction: format correct selon la doc
      return request("/magnet/upload/file", "POST", formData, true).then(res => {
        console.log("🔍 Réponse uploadTorrentFile:", res);

        if (res.status === "success") {
          // Selon la doc, la réponse contient un array "files"
          if (res.data.files && res.data.files[0]) {
            const fileData = res.data.files[0];
            console.log("✅ Format files détecté:", fileData);
            return fileData; // Retourner l'objet complet avec id, name, etc.
          }
        }

        console.log("❌ Format de réponse non reconnu:", res);
        return $q.reject(res);
      });
    }

    // Vérifie le statut du magnet (version v4 pour les liens directs)
    function getMagnetStatusWithLinks(id) {
      const body = { id: id };
      return request("/magnet/status", "POST", body, false).then(res => {
        console.log("🔍 Réponse getMagnetStatusWithLinks (v4):", res);
        console.log("🔍 Structure res.data:", res.data);
        console.log("🔍 res.data.magnets:", res.data.magnets);

        if (res.status === "success" && res.data.magnets) {
          // Vérifier si c'est un array ou un objet
          console.log(
            "🔍 Type de magnets:",
            typeof res.data.magnets,
            Array.isArray(res.data.magnets)
          );

          let magnet;
          if (Array.isArray(res.data.magnets)) {
            magnet = res.data.magnets[0];
            console.log("📋 Magnet depuis array[0]:", magnet);
          } else {
            magnet = res.data.magnets;
            console.log("📋 Magnet depuis objet direct:", magnet);
          }

          console.log("✅ Magnet extrait (avec liens):", magnet);
          return magnet;
        }

        console.log("❌ Format getMagnetStatusWithLinks non reconnu:", res);
        return $q.reject(res);
      });
    }

    // Vérifie le statut du magnet (version v4.1 pour polling)
    function getMagnetStatus(id) {
      const body = { id: id };
      return request("/v4.1/magnet/status", "POST", body, false).then(res => {
        console.log("🔍 Réponse getMagnetStatus (v4.1):", res);

        if (res.status === "success" && res.data.magnets) {
          const magnet = res.data.magnets[0];
          console.log("✅ Magnet extrait:", magnet);
          return magnet;
        }

        console.log("❌ Format getMagnetStatus non reconnu:", res);
        return $q.reject(res);
      });
    }

    // Déverrouille un lien AllDebrid pour obtenir le lien de téléchargement direct
    function unlockLink(alldebridUrl) {
      const body = { link: alldebridUrl };
      return request("/link/unlock", "POST", body, false).then(res => {
        console.log("🔓 Réponse unlockLink:", res, "pour", alldebridUrl);

        if (res.status === "success" && res.data.link) {
          console.log("✅ Lien direct obtenu:", res.data.link);
          return {
            directLink: res.data.link,
            filename: res.data.filename,
            size: res.data.filesize
          };
        }

        console.log("❌ Impossible de déverrouiller le lien:", res);
        return $q.reject(res);
      });
    }

    // Récupère les liens de fichiers
    function getFilesLinks(id) {
      const body = { id: [id] }; // API attend un array d'IDs
      return request("/magnet/files", "POST", body, false).then(res => {
        console.log("🔍 Réponse getFilesLinks:", res);
        if (
          res.status === "success" &&
          res.data.magnets &&
          res.data.magnets[0] &&
          res.data.magnets[0].files
        ) {
          console.log("✅ Files récupérés:", res.data.magnets[0].files);
          return res.data.magnets[0].files;
        }
        console.log("❌ Format getFilesLinks non reconnu:", res);
        return $q.reject(res);
      });
    }

    // Fonction complète pour uploader un torrent et récupérer les liens
    function uploadTorrentToAllDebrid(file, callback) {
      uploadTorrentFile(file).then(
        function(response) {
          console.log("🔍 Réponse uploadTorrentFile dans uploadTorrentToAllDebrid:", response);

          if (response && response.id) {
            console.log("📋 Upload réussi, ID magnet:", response.id);

            if (response.ready) {
              // Déjà prêt, utiliser v4 pour obtenir les liens directs
              console.log("✅ Magnet déjà prêt, récupération des liens via v4...");
              getMagnetStatusWithLinks(response.id).then(
                function(status) {
                  console.log("📊 Status avec liens:", status);
                  console.log("🔍 Vérification status.links:", status.links);
                  console.log(
                    "🔍 Type de status.links:",
                    typeof status.links,
                    Array.isArray(status.links)
                  );
                  console.log(
                    "🔍 Longueur status.links:",
                    status.links ? status.links.length : "undefined"
                  );

                  if (status.links && status.links.length > 0) {
                    console.log("✅ Liens AllDebrid récupérés:", status.links);

                    // Déverrouiller tous les liens AllDebrid pour obtenir les liens directs
                    console.log("🔓 Déverrouillage des liens AllDebrid...");
                    const unlockPromises = status.links.map(linkObj => {
                      console.log("🔓 Déverrouillage du lien:", linkObj.link);
                      return unlockLink(linkObj.link).then(
                        unlockedData => {
                          console.log("✅ Lien déverrouillé:", unlockedData);
                          return {
                            name: unlockedData.filename,
                            size: unlockedData.size,
                            link: unlockedData.directLink
                          };
                        },
                        err => {
                          console.log("❌ Erreur déverrouillage lien:", linkObj.link, err);
                          return null; // Ignorer les liens qui échouent
                        }
                      );
                    });

                    console.log("🔄 Attente des déverrouillages...");
                    Promise.all(unlockPromises).then(unlockedLinks => {
                      const validLinks = unlockedLinks.filter(link => link !== null);
                      console.log("✅ Liens directs déverrouillés:", validLinks);
                      if (callback) callback(null, validLinks);
                    });
                  } else {
                    console.log("⚠️ Pas de liens dans le status, tentative getFilesLinks...");
                    getFilesLinks(response.id).then(
                      function(files) {
                        console.log("✅ Fichiers récupérés en fallback:", files);
                        if (callback) callback(null, files);
                      },
                      function(err) {
                        console.log("❌ Erreur getFilesLinks fallback:", err);
                        if (callback)
                          callback("Impossible de récupérer les liens pour ce magnet prêt");
                      }
                    );
                  }
                },
                function(err) {
                  console.log("❌ Erreur getMagnetStatusWithLinks:", err);
                  if (callback) callback(err);
                }
              );
            } else {
              // En cours de traitement, faire du polling avec v4.1
              console.log("⏳ Magnet en cours de traitement, polling...");
              pollMagnetStatus(response.id, callback);
            }
          } else {
            console.log("❌ Réponse upload sans ID:", response);
            if (callback) callback("Réponse AllDebrid sans ID de magnet");
          }
        },
        function(err) {
          console.log("❌ Erreur uploadTorrentFile:", err);
          if (callback) callback(err);
        }
      );
    } // Fonction de polling séparée pour plus de clarté
    function pollMagnetStatus(magnetId, callback) {
      function pollStatus() {
        getMagnetStatus(magnetId).then(
          function(status) {
            console.log("📊 Status polling:", status);
            if (status.statusCode === 4) {
              // Ready - récupérer les fichiers
              console.log("✅ Magnet ready, récupération des fichiers...");
              getFilesLinks(magnetId).then(
                function(files) {
                  console.log("✅ Liens récupérés:", files);
                  if (callback) callback(null, files);
                },
                function(err) {
                  console.log("❌ Erreur getFilesLinks:", err);
                  if (callback) callback(err);
                }
              );
            } else if (status.statusCode >= 5) {
              console.log("❌ Erreur statut:", status);
              if (callback) callback("Erreur AllDebrid: " + status.status);
            } else {
              console.log("⏳ En attente, re-polling dans 5s...");
              setTimeout(pollStatus, 5000);
            }
          },
          function(err) {
            console.log("❌ Erreur getMagnetStatus:", err);
            if (callback) callback(err);
          }
        );
      }
      pollStatus();
    }

    return {
      setApiKey,
      uploadTorrentFile,
      getMagnetStatus,
      getMagnetStatusWithLinks,
      unlockLink,
      getFilesLinks,
      uploadTorrentToAllDebrid
    };
  }
]).name;
