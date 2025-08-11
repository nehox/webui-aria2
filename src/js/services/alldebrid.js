import angular from "angular";

export default angular.module("webui.services.alldebrid", []).factory("$alldebrid", [
  "$q",
  function($q) {
    // Remplacez par votre API key AllDebrid
    const API_KEY = ""; // <-- à renseigner dans les paramètres utilisateur
    const BASE_URL = "https://api.alldebrid.com/v4";

    function request(endpoint, method, body, isFormData) {
      const headers = {
        "Authorization": `Bearer ${API_KEY}`
      };
      let options = {
        method,
        headers,
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
      formData.append("files[]", file);
      return request("/magnet/upload/file", "POST", formData, true)
        .then(res => {
          if (res.status === "success" && res.data.files && res.data.files[0].id) {
            return res.data.files[0].id;
          }
          return $q.reject(res);
        });
    }

    // Vérifie le statut du magnet
    function getMagnetStatus(id) {
      return request("/v4.1/magnet/status", "POST", { id }, false)
        .then(res => {
          if (res.status === "success" && res.data.magnets && res.data.magnets[0]) {
            return res.data.magnets[0];
          }
          return $q.reject(res);
        });
    }

    // Récupère les liens de fichiers
    function getFilesLinks(id) {
      return request("/magnet/files", "POST", { id }, false)
        .then(res => {
          if (res.status === "success" && res.data.magnets && res.data.magnets[0].files) {
            return res.data.magnets[0].files;
          }
          return $q.reject(res);
        });
    }

    return {
      uploadTorrentFile,
      getMagnetStatus,
      getFilesLinks
    };
  }
]).name;
