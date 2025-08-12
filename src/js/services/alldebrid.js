import angular from "angular";

export default angular.module("webui.services.alldebrid", []).factory("$alldebrid", [
  "$q",
  function($q) {
    let apiKey = localStorage.getItem("alldebridApiKey") || "";
    const BASE_URL = "https://api.alldebrid.com/v4";

    // Rate limiting selon la documentation AllDebrid
    const rateLimiter = {
      requestQueue: [],
      processing: false,
      lastRequestTime: 0,
      requestCount: 0,
      minuteRequestCount: 0,
      minuteStartTime: Date.now(),

      // Limites AllDebrid : 12 req/sec, 600 req/min
      MAX_REQUESTS_PER_SECOND: 12,
      MAX_REQUESTS_PER_MINUTE: 600,
      MIN_INTERVAL: 1000 / 12, // ~83ms entre requêtes

      processQueue() {
        if (this.processing || this.requestQueue.length === 0) return;

        this.processing = true;
        const now = Date.now();

        // Reset compteur minute si nécessaire
        if (now - this.minuteStartTime > 60000) {
          this.minuteRequestCount = 0;
          this.minuteStartTime = now;
        }

        // Vérifier limites
        if (this.minuteRequestCount >= this.MAX_REQUESTS_PER_MINUTE) {
          console.log("⏳ Limite minute atteinte, attente...");
          setTimeout(() => {
            this.processing = false;
            this.processQueue();
          }, 60000 - (now - this.minuteStartTime));
          return;
        }

        const timeSinceLastRequest = now - this.lastRequestTime;
        const delay = Math.max(0, this.MIN_INTERVAL - timeSinceLastRequest);

        setTimeout(() => {
          if (this.requestQueue.length > 0) {
            const { resolve, reject, requestFn } = this.requestQueue.shift();
            this.lastRequestTime = Date.now();
            this.requestCount++;
            this.minuteRequestCount++;

            requestFn()
              .then(resolve)
              .catch(reject)
              .finally(() => {
                this.processing = false;
                this.processQueue();
              });
          } else {
            this.processing = false;
          }
        }, delay);
      },

      addToQueue(requestFn) {
        return new Promise((resolve, reject) => {
          this.requestQueue.push({ resolve, reject, requestFn });
          this.processQueue();
        });
      }
    };

    function setApiKey(key) {
      apiKey = key;
      localStorage.setItem("alldebridApiKey", key);
    }

    // Fonction request avec retry automatique
    function request(endpoint, method, body, isFormData, retryCount = 0) {
      const maxRetries = 3;

      const makeRequest = () => {
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
          .then(response => {
            // Vérifier erreurs 429/503 (rate limit)
            if (response.status === 429 || response.status === 503) {
              throw new Error(`Rate limit: ${response.status}`);
            }
            return response.json();
          })
          .catch(error => {
            // Retry pour erreurs 429/503
            if (
              (error.message.includes("429") || error.message.includes("503")) &&
              retryCount < maxRetries
            ) {
              const retryDelay = Math.pow(2, retryCount) * 1000; // Backoff exponentiel
              console.log(
                `⏳ Rate limit, retry ${retryCount + 1}/${maxRetries} dans ${retryDelay}ms`
              );
              return new Promise(resolve => {
                setTimeout(() => {
                  resolve(request(endpoint, method, body, isFormData, retryCount + 1));
                }, retryDelay);
              });
            }
            throw error;
          });
      };

      // Ajouter à la queue de rate limiting
      return rateLimiter.addToQueue(makeRequest);
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
      return request("/link/unlock", "POST", body, false)
        .then(res => {
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
        })
        .catch(error => {
          console.log("❌ Erreur déverrouillage lien:", alldebridUrl, error);
          throw error;
        });
    }

    // Déverrouille plusieurs liens avec gestion de progression et batch
    function unlockLinksWithProgress(links, progressCallback) {
      const BATCH_SIZE = 5; // Traiter 5 liens à la fois
      const results = [];
      let processed = 0;

      console.log(`🔓 Déverrouillage de ${links.length} liens par batch de ${BATCH_SIZE}`);

      return new Promise(resolve => {
        const processBatch = startIndex => {
          const batch = links.slice(startIndex, startIndex + BATCH_SIZE);
          if (batch.length === 0) {
            resolve(results.filter(r => r !== null));
            return;
          }

          const batchPromises = batch.map((linkObj, index) => {
            const globalIndex = startIndex + index;
            console.log(`🔓 Déverrouillage ${globalIndex + 1}/${links.length}: ${linkObj.link}`);

            return unlockLink(linkObj.link)
              .then(unlockedData => {
                processed++;
                if (progressCallback) {
                  progressCallback(
                    processed,
                    links.length,
                    `Lien ${processed}/${links.length} déverrouillé`
                  );
                }
                console.log(`✅ Lien ${globalIndex + 1} déverrouillé:`, unlockedData);
                return {
                  name: unlockedData.filename,
                  size: unlockedData.size,
                  link: unlockedData.directLink
                };
              })
              .catch(err => {
                processed++;
                if (progressCallback) {
                  progressCallback(
                    processed,
                    links.length,
                    `Erreur lien ${processed}/${links.length}`
                  );
                }
                console.log(`❌ Erreur lien ${globalIndex + 1}:`, err);
                return null; // Continuer malgré l'erreur
              });
          });

          Promise.all(batchPromises).then(batchResults => {
            results.push(...batchResults);
            // Traiter le batch suivant après un petit délai
            setTimeout(() => processBatch(startIndex + BATCH_SIZE), 500);
          });
        };

        processBatch(0);
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
    function uploadTorrentToAllDebrid(file, callback, progressCallback) {
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

                    // Utiliser la nouvelle fonction avec progression et rate limiting
                    console.log("🔓 Déverrouillage des liens AllDebrid avec progression...");
                    unlockLinksWithProgress(status.links, progressCallback).then(validLinks => {
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
              pollMagnetStatus(response.id, callback, progressCallback);
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
    }

    // Fonction de polling séparée pour plus de clarté
    function pollMagnetStatus(magnetId, callback, progressCallback) {
      function pollStatus() {
        getMagnetStatus(magnetId).then(
          function(status) {
            console.log("📊 Status polling:", status);
            if (progressCallback) {
              progressCallback(
                status.downloaded || 0,
                status.size || 1,
                `Téléchargement: ${status.status}`
              );
            }

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
      unlockLinksWithProgress,
      getFilesLinks,
      uploadTorrentToAllDebrid
    };
  }
]).name;
